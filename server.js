import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSkills, publicSkill } from './lib/catalog.js';
import { JsonStore } from './lib/store.js';
import { InputError, validateProjectInput, validateSkillInput } from './lib/validation.js';
import { executionPlan, integrationStatus } from './lib/integrations.js';
import { requireRole, resolveUser } from './lib/auth.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const stateFile = process.env.STATE_FILE || join(root, 'var', 'state.json');
const store = new JsonStore(stateFile);
await store.init();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

function send(response, statusCode, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  response.writeHead(statusCode, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8', ...headers });
  response.end(payload);
}

function apiError(response, statusCode, code, message, details = undefined) {
  send(response, statusCode, { error: { code, message, ...(details ? { details } : {}) } });
}

async function parseBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new InputError('Żądanie jest zbyt duże.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new InputError('Treść żądania nie jest poprawnym JSON-em.');
  }
}

function audit(state, user, action, targetId, requestId) {
  state.audit.unshift({ id: randomUUID(), at: new Date().toISOString(), userId: user.id, action, targetId, requestId });
  state.audit = state.audit.slice(0, 1000);
}

async function handleApi(request, response, url, requestId) {
  const user = resolveUser(request);
  if (!user) return apiError(response, 401, 'UNAUTHENTICATED', 'Zaloguj się, aby kontynuować.');

  if (request.method === 'GET' && url.pathname === '/api/health') {
    return send(response, 200, { status: 'ok', version: '0.1.0', integrations: integrationStatus(), requestId });
  }
  if (request.method === 'GET' && url.pathname === '/api/me') return send(response, 200, { user });

  if (request.method === 'GET' && url.pathname === '/api/skills') {
    const includeDrafts = user.role === 'admin' && url.searchParams.get('includeDrafts') === 'true';
    const skills = (await loadSkills()).map((skill) => publicSkill(skill, includeDrafts)).filter(Boolean);
    return send(response, 200, { skills });
  }

  if (request.method === 'GET' && url.pathname === '/api/runs') {
    const state = await store.read();
    const runs = state.runs.filter((run) => user.role === 'admin' || run.userId === user.id).slice(0, 100);
    return send(response, 200, { runs });
  }

  if (request.method === 'POST' && url.pathname === '/api/runs') {
    if (!requireRole(user, ['manager', 'admin'])) return apiError(response, 403, 'FORBIDDEN', 'Brak uprawnień do uruchamiania skilli.');
    const body = await parseBody(request);
    const skill = (await loadSkills()).find((item) => item.id === body.skillId);
    if (!skill || skill.status !== 'published') return apiError(response, 404, 'SKILL_NOT_FOUND', 'Skill nie istnieje lub nie został opublikowany.');
    const input = validateSkillInput(skill, body.input);
    const plan = executionPlan(skill, input);
    const run = {
      id: randomUUID(),
      skillId: skill.id,
      skillTitle: skill.title,
      userId: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      requiresReview: Boolean(skill.requiresReview),
      input,
      ...plan
    };
    await store.update((state) => {
      state.runs.unshift(run);
      audit(state, user, 'skill.run.created', run.id, requestId);
    });
    return send(response, 201, { run });
  }

  if (request.method === 'GET' && url.pathname === '/api/creator/projects') {
    const state = await store.read();
    const projects = state.projects.filter((project) => user.role === 'admin' || project.ownerId === user.id);
    return send(response, 200, { projects });
  }

  if (request.method === 'POST' && url.pathname === '/api/creator/projects') {
    const input = validateProjectInput(await parseBody(request));
    const project = {
      id: randomUUID(),
      ownerId: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      currentStage: 'brief',
      progress: 10,
      ...input
    };
    await store.update((state) => {
      state.projects.unshift(project);
      audit(state, user, 'creator.project.created', project.id, requestId);
    });
    return send(response, 201, { project });
  }

  return apiError(response, 404, 'NOT_FOUND', 'Nie znaleziono endpointu.');
}

async function serveStatic(response, pathname) {
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
  const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = join(root, safePath);
  if (!filePath.startsWith(root)) return apiError(response, 404, 'NOT_FOUND', 'Nie znaleziono pliku.');
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error('not a file');
    const body = await readFile(filePath);
    response.writeHead(200, {
      ...securityHeaders,
      'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=300'
    });
    response.end(body);
  } catch {
    apiError(response, 404, 'NOT_FOUND', 'Nie znaleziono pliku.');
  }
}

export const server = createServer(async (request, response) => {
  const requestId = randomUUID();
  response.setHeader('X-Request-Id', requestId);
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) await handleApi(request, response, url, requestId);
    else if (request.method === 'GET' || request.method === 'HEAD') await serveStatic(response, url.pathname);
    else apiError(response, 405, 'METHOD_NOT_ALLOWED', 'Ta metoda nie jest obsługiwana.');
  } catch (error) {
    if (error instanceof InputError) apiError(response, 400, 'INVALID_INPUT', error.message, error.details);
    else {
      console.error(`[${requestId}]`, error);
      apiError(response, 500, 'INTERNAL_ERROR', 'Wystąpił nieoczekiwany błąd.');
    }
  }
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(port, host, () => console.log(`Startup 2.0 działa na http://${host}:${port}`));
}
