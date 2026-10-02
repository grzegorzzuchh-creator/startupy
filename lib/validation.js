const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class InputError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'InputError';
    this.details = details;
  }
}

export function validateSkillInput(skill, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError('Niepoprawne dane wejściowe.');
  const clean = {};
  const errors = [];

  for (const field of skill.fields) {
    let value = input[field.name];
    if (typeof value === 'string') value = value.trim();
    if ((value === undefined || value === '') && field.default !== undefined) value = field.default;
    if (field.required && (value === undefined || value === '')) {
      errors.push(`${field.label}: pole jest wymagane.`);
      continue;
    }
    if (value === undefined || value === '') continue;
    if (field.type === 'emails') {
      const emails = Array.isArray(value) ? value : String(value).split(/[\n,;]/);
      const normalized = [...new Set(emails.map((item) => item.trim().toLowerCase()).filter(Boolean))];
      const invalid = normalized.filter((email) => !emailPattern.test(email));
      if (invalid.length) errors.push(`${field.label}: niepoprawne adresy: ${invalid.join(', ')}.`);
      clean[field.name] = normalized;
      continue;
    }
    if (field.type === 'select' && !field.options?.includes(String(value))) {
      errors.push(`${field.label}: wybierz dozwoloną wartość.`);
      continue;
    }
    clean[field.name] = String(value).slice(0, field.type === 'textarea' ? 10000 : 1000);
  }

  if (errors.length) throw new InputError('Uzupełnij formularz.', errors);
  return clean;
}

export function validateProjectInput(input) {
  if (!input || typeof input !== 'object') throw new InputError('Niepoprawne dane projektu.');
  const name = String(input.name || '').trim();
  const goal = String(input.goal || '').trim();
  if (!name || !goal) throw new InputError('Nazwa i cel projektu są wymagane.');
  return {
    name: name.slice(0, 160),
    goal: goal.slice(0, 2000),
    audience: String(input.audience || '').trim().slice(0, 1000),
    market: String(input.market || 'Polska').trim().slice(0, 120)
  };
}
