import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let server;
let baseUrl;
let temporaryDirectory;

before(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), 'startup-2-test-'));
  process.env.NODE_ENV = 'test';
  process.env.STATE_FILE = join(temporaryDirectory, 'state.json');
  ({ server } = await import(`../server.js?test=${Date.now()}`));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
});

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  return { response, body: await response.json() };
}

test('health endpoint exposes safe integration status and security headers', async () => {
  const { response, body } = await request('/api/health');
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.integrations.outlook.configured, false);
  assert.equal(body.integrations.sharepoint.visibleToManagers, false);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
});

test('manager sees only published skills and no creator-as-skill', async () => {
  const { response, body } = await request('/api/skills');
  assert.equal(response.status, 200);
  assert.deepEqual(body.skills.map((skill) => skill.id).sort(), ['expert-database', 'send-emails']);
  assert.equal(body.skills.some((skill) => /kreator/i.test(skill.title)), false);
});

test('email skill creates a review item without sending', async () => {
  const { response, body } = await request('/api/runs', {
    method: 'POST',
    body: JSON.stringify({ skillId: 'send-emails', input: {
      recipients: 'weronika.sobolewska@warsawexpo.eu',
      subject: 'Dostęp do panelu',
      message: 'Zapraszamy.'
    } })
  });
  assert.equal(response.status, 201);
  assert.equal(body.run.status, 'awaiting-review');
  assert.equal(body.run.mode, 'preview');
  assert.match(body.run.message, /niczego nie wysłano/i);
});

test('email validation rejects malformed recipients', async () => {
  const { response, body } = await request('/api/runs', {
    method: 'POST',
    body: JSON.stringify({ skillId: 'send-emails', input: {
      recipients: 'brak-adresu', subject: 'Temat', message: 'Treść'
    } })
  });
  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'INVALID_INPUT');
});

test('creator stores a draft project separately from skills', async () => {
  const created = await request('/api/creator/projects', {
    method: 'POST',
    body: JSON.stringify({ name: 'HealthTech Expo', goal: 'Połączyć rynek medyczny', audience: 'Eksperci i firmy', market: 'Polska' })
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.project.currentStage, 'brief');
  assert.equal(created.body.project.progress, 10);

  const listed = await request('/api/creator/projects');
  assert.equal(listed.response.status, 200);
  assert.equal(listed.body.projects.length, 1);
});
