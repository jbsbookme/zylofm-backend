import { requireRole } from '../_jwtAuth';
import { Role, setUserRole } from '../_roles';
import { jsonError, jsonResponse } from '../_http';
import { withRequestLogging } from '../_observability';

export const config = { runtime: 'edge' };

type Body = { userId: string; role: Role };

export default async function handler(req: Request) {
  return withRequestLogging(req, 'admin.role', async () => {
  if (req.method !== 'POST') {
    return jsonError(405, 'method_not_allowed', 'Method Not Allowed');
  }

  try {
    await requireRole(req, ['admin']);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return jsonError(status, 'unauthorized', message);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError(400, 'invalid_json', 'Invalid JSON');
  }

  if (!body?.userId || !body?.role) {
    return jsonError(400, 'missing_fields', 'Missing userId or role');
  }

  if (!['admin', 'dj', 'user'].includes(body.role)) {
    return jsonError(400, 'invalid_role', 'Invalid role');
  }

  await setUserRole(body.userId, body.role);

  return jsonResponse({ ok: true, userId: body.userId, role: body.role }, 200);
  });
}
