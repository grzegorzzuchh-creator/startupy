const demoUser = {
  id: 'demo-manager',
  name: 'Anna Kozłowska',
  email: 'anna.kozlowska@example.invalid',
  role: 'manager'
};

export function resolveUser(request) {
  if (process.env.AUTH_MODE !== 'trusted-header') return demoUser;
  const id = request.headers['x-user-id'];
  const email = request.headers['x-user-email'];
  const name = request.headers['x-user-name'];
  const role = request.headers['x-user-role'];
  if (!id || !email || !name || !['manager', 'admin'].includes(role)) return null;
  return { id: String(id), email: String(email), name: String(name), role: String(role) };
}

export function requireRole(user, roles) {
  return user && roles.includes(user.role);
}
