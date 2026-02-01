import { getBearerToken, verifyJwt } from './_jwt';
import { Role, hasRequiredRole } from './_roles';
import { env } from './_env';

export async function requireAccessToken(req: Request) {
  const token = getBearerToken(req);
  if (!token) throw new Error('Missing bearer token');
  const payload = await verifyJwt(token);
  if (payload.type !== 'access') throw new Error('Invalid token type');
  return payload;
}

export async function requireRole(req: Request, roles: Role[]) {
  const payload = await requireAccessToken(req);
  const role = payload.role as Role | undefined;
  const adminEmail = env.ADMIN_EMAIL;
  const adminUserId = env.ADMIN_USER_ID;
  const effectiveRole: Role | undefined =
    (adminEmail && payload.email === adminEmail) ||
    (adminUserId && payload.sub === adminUserId)
      ? 'admin'
      : role;
  if (!effectiveRole) throw new Error('Missing role');
  const allowed = roles.some((required) => hasRequiredRole(effectiveRole, required));
  if (!allowed) throw new Error('Forbidden');
  return payload;
}

export { requireAccessToken as requireAccess, requireRole as requireAccessRole };
