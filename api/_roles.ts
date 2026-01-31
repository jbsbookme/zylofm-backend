import { kvGet, kvSet } from './_kv';

export type Role = 'admin' | 'dj' | 'user';

const ROLE_RANK: Record<Role, number> = {
  admin: 3,
  dj: 2,
  user: 1,
};

export function hasRequiredRole(userRole: Role, requiredRole: Role) {
  return ROLE_RANK[userRole] >= ROLE_RANK[requiredRole];
}

export async function resolveUserRole(userId: string, fallback: Role): Promise<Role> {
  const stored = await kvGet(`userrole:${userId}`);
  if (typeof stored === 'string') {
    if (stored === 'admin' || stored === 'dj' || stored === 'user') return stored;
  }
  return fallback;
}

export async function setUserRole(userId: string, role: Role) {
  await kvSet(`userrole:${userId}`, role);
}
