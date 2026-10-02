const state = { skills: [], runs: [], projects: [], activeSkill: null };
const toast = document.querySelector('.toast');
const staticDemo = window.location.hostname.endsWith('github.io') || window.location.hostname === 'raw.githack.com';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

async function api(path, options = {}) {
  if (staticDemo) return demoApi(path, options);
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json();
  if (!response.ok) {
    const details = body.error?.details?.join(' ') || '';
    throw new Error(`${body.error?.message || 'Nie udało się wykonać operacji.'} ${details}`.trim());
  }
  return body;
}

async function demoApi(path, options = {}) {
  const method = options.method || 'GET';
  if (path === '/api/me') return { user: { id: 'demo-manager', name: 'Anna Kozłowska', role: 'manager' } };
  if (path === '/api/skills') {
    const response = await fetch('data/skills.json');
    const skills = await response.json();
    return { skills: skills.filter((skill) => skill.status === 'published').map(({ executor, ...skill }) => skill) };
  }
  if (path === '/api/runs' && method === 'GET') return { runs: JSON.parse(localStorage.getItem('startup20-runs') || '[]') };
  if (path === '/api/runs' && method === 'POST') {
    const payload = JSON.parse(options.body || '{}');
    const skill = state.skills.find((item) => item.id === payload.skillId);
    const recipients = String(payload.input?.recipients || '').split(/[\n,;]/).map((item) => item.trim()).filter(Boolean);
    if (payload.skillId === 'send-emails' && (!recipients.length || recipients.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))) throw new Error('Podaj poprawne adresy odbiorców.');
    const run = { id: crypto.randomUUID(), skillId: payload.skillId, skillTitle: skill?.title || 'Skill', createdAt: new Date().toISOString(), status: payload.skillId === 'send-emails' ? 'awaiting-review' : 'queued', summary: payload.skillId === 'send-emails' ? `${recipients.length} odbiorców` : skill?.title, message: payload.skillId === 'send-emails' ? 'Przygotowano podgląd demonstracyjny. Niczego nie wysłano.' : 'Zadanie demonstracyjne zapisano lokalnie.' };
    const runs = [run, ...JSON.parse(localStorage.getItem('startup20-runs') || '[]')];
    localStorage.setItem('startup20-runs', JSON.stringify(runs));
    return { run };
  }
  if (path === '/api/creator/projects' && method === 'GET') return { projects: JSON.parse(localStorage.getItem('startup20-projects') || '[]') };
  if (path === '/api/creator/projects' && method === 'POST') {
    const input = JSON.parse(options.body || '{}');
    if (!input.name?.trim() || !input.goal?.trim()) throw new Error('Nazwa i cel projektu są wymagane.');
    const project = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'draft', currentStage: 'brief', progress: 10, ...input };
    const projects = [project, ...JSON.parse(localStorage.getItem('startup20-projects') || '[]')];
    localStorage.setItem('startup20-projects', JSON.stringify(projects));
    return { project };
  }
  throw new Error('Ta funkcja nie jest dostępna w demonstratorze.');
}

function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 4200);
}

function showView(name) {
  document.querySelectorAll('.view').forEach((view) => {
    const active = view.dataset.page === name;
    view.hidden = !active;
    view.classList.toggle('active', active);
  });
  document.querySelectorAll('.nav-link').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
  if (name === 'history') refreshRuns();
  if (name === 'projects') refreshProjects();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function skillCard(skill, featured) {
  if (featured) {
    return `<article class="skill-card featured"><div class="card-icon" aria-hidden="true">${escapeHtml(skill.icon || '✦')}</div><div class="card-copy"><span class="tag">${escapeHtml(skill.category || 'SKILL')}</span><h2>${escapeHtml(skill.title)}</h2><p>${escapeHtml(skill.description)}</p><button class="primary-button" type="button" data-skill="${escapeHtml(skill.id)}">Uruchom skill <span aria-hidden="true">→</span></button></div></article>`;
  }
  return `<button class="small-card" type="button" data-skill="${escapeHtml(skill.id)}"><span class="small-icon">${escapeHtml(skill.icon || '✦')}</span><span><strong>${escapeHtml(skill.title)}</strong><small>${escapeHtml(skill.description)}</small></span><b>→</b></button>`;
}

function renderSkills() {
  document.getElementById('catalog-loading').hidden = true;
  const featured = state.skills.filter((skill) => skill.featured);
  const other = state.skills.filter((skill) => !skill.featured);
  document.getElementById('featured-skills').innerHTML = featured.map((skill) => skillCard(skill, true)).join('');
  document.getElementById('more-skills').innerHTML = other.map((skill) => skillCard(skill, false)).join('');
  document.getElementById('more-section').hidden = other.length === 0;
  document.getElementById('catalog-count').textContent = `${state.skills.length} opublikowane`;
  document.querySelectorAll('[data-skill]').forEach((button) => button.addEventListener('click', () => openSkill(button.dataset.skill)));
}

function fieldMarkup(field) {
  const common = `id="field-${escapeHtml(field.name)}" name="${escapeHtml(field.name)}" ${field.required ? 'required' : ''}`;
  const label = `<label for="field-${escapeHtml(field.name)}">${escapeHtml(field.label)}</label>`;
  if (field.type === 'textarea' || field.type === 'emails') {
    const value = field.default ? escapeHtml(field.default) : '';
    return `${label}<textarea ${common} rows="${field.type === 'emails' ? 4 : 5}" placeholder="${escapeHtml(field.placeholder || '')}">${value}</textarea>`;
  }
  if (field.type === 'select') {
    return `${label}<select ${common}>${field.options.map((option) => `<option ${option === field.default ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select>`;
  }
  return `${label}<input ${common} value="${escapeHtml(field.default || '')}" placeholder="${escapeHtml(field.placeholder || '')}" />`;
}

function openSkill(skillId) {
  const skill = state.skills.find((item) => item.id === skillId);
  if (!skill) return;
  state.activeSkill = skill;
  document.getElementById('skill-dialog-title').textContent = skill.title;
  document.getElementById('skill-dialog-description').textContent = skill.description;
  document.getElementById('skill-fields').innerHTML = skill.fields.map(fieldMarkup).join('');
  document.getElementById('skill-modal').showModal();
}

async function submitSkill(event) {
  event.preventDefault();
  if (!state.activeSkill) return;
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const { run } = await api('/api/runs', { method: 'POST', body: JSON.stringify({ skillId: state.activeSkill.id, input: data }) });
    document.getElementById('skill-modal').close();
    showToast(run.message, 'success');
  } catch (error) { showToast(error.message, 'error'); }
}

function statusLabel(status) {
  return ({ 'awaiting-review': 'Oczekuje na zatwierdzenie', queued: 'W kolejce', completed: 'Zakończone', failed: 'Błąd' })[status] || status;
}

async function refreshRuns() {
  try {
    const { runs } = await api('/api/runs');
    state.runs = runs;
    document.getElementById('runs-list').innerHTML = runs.length ? runs.map((run) => `<article class="record-row"><div class="record-icon">✦</div><div><strong>${escapeHtml(run.skillTitle)}</strong><small>${new Date(run.createdAt).toLocaleString('pl-PL')} · ${escapeHtml(run.summary || '')}</small></div><span class="status-pill status-${escapeHtml(run.status)}">${escapeHtml(statusLabel(run.status))}</span></article>`).join('') : '<div class="empty-state">Nie uruchomiono jeszcze żadnego skilla.</div>';
  } catch (error) { showToast(error.message, 'error'); }
}

async function refreshProjects() {
  try {
    const { projects } = await api('/api/creator/projects');
    state.projects = projects;
    document.getElementById('projects-list').innerHTML = projects.length ? projects.map((project) => `<article class="project-card"><span class="stage-badge">${escapeHtml(project.currentStage)}</span><h2>${escapeHtml(project.name)}</h2><p>${escapeHtml(project.goal)}</p><div class="progress"><span style="width:${Number(project.progress) || 0}%"></span></div><small>${Number(project.progress) || 0}% przygotowania · ${escapeHtml(project.market)}</small></article>`).join('') : '<div class="empty-state">Brak projektów. Rozpocznij w Kreatorze targowym.</div>';
  } catch (error) { showToast(error.message, 'error'); }
}

async function submitProject(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    await api('/api/creator/projects', { method: 'POST', body: JSON.stringify(data) });
    event.currentTarget.reset();
    showToast('Utworzono wersję roboczą projektu.', 'success');
    showView('projects');
  } catch (error) { showToast(error.message, 'error'); }
}

async function init() {
  try {
    const [{ user }, { skills }] = await Promise.all([api('/api/me'), api('/api/skills')]);
    state.skills = skills;
    document.getElementById('profile-name').textContent = user.name;
    document.getElementById('avatar').textContent = user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
    renderSkills();
    if (staticDemo) document.querySelector('.agent-badge').textContent = '✦ Tryb demonstracyjny';
  } catch (error) {
    document.getElementById('catalog-loading').textContent = 'Nie udało się wczytać katalogu.';
    showToast(error.message, 'error');
  }
}

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
document.getElementById('skill-modal').addEventListener('click', (event) => { if (event.target.id === 'skill-modal') event.target.close(); });
document.getElementById('skill-form').addEventListener('submit', submitSkill);
document.getElementById('creator-form').addEventListener('submit', submitProject);
init();
