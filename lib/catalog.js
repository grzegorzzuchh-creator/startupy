import { readFile } from 'node:fs/promises';

const catalogUrl = new URL('../data/skills.json', import.meta.url);

export async function loadSkills() {
  const raw = await readFile(catalogUrl, 'utf8');
  const skills = JSON.parse(raw);
  validateCatalog(skills);
  return skills;
}

export function validateCatalog(skills) {
  if (!Array.isArray(skills)) throw new Error('Katalog skilli musi być tablicą.');
  const ids = new Set();
  for (const skill of skills) {
    for (const key of ['id', 'title', 'description', 'status', 'executor']) {
      if (!skill[key] || typeof skill[key] !== 'string') throw new Error(`Skill nie ma poprawnego pola ${key}.`);
    }
    if (!/^[a-z0-9-]+$/.test(skill.id)) throw new Error(`Niepoprawne id skilla: ${skill.id}`);
    if (ids.has(skill.id)) throw new Error(`Powtórzone id skilla: ${skill.id}`);
    if (!['draft', 'published', 'archived'].includes(skill.status)) throw new Error(`Niepoprawny status skilla: ${skill.id}`);
    if (!Array.isArray(skill.fields)) throw new Error(`Pola skilla ${skill.id} muszą być tablicą.`);
    ids.add(skill.id);
  }
}

export function publicSkill(skill, includeDrafts = false) {
  if (!includeDrafts && skill.status !== 'published') return null;
  return {
    id: skill.id,
    title: skill.title,
    description: skill.description,
    category: skill.category,
    icon: skill.icon,
    featured: Boolean(skill.featured),
    status: skill.status,
    requiresReview: Boolean(skill.requiresReview),
    fields: skill.fields
  };
}
