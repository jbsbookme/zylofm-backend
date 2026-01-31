import { requireRole } from '../_jwtAuth';
import { Role, setUserRole } from '../_roles';

export const config = { runtime: 'edge' };

type Body = { userId: string; role: Role };

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    await requireRole(req, ['admin']);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return new Response(message, { status });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!body?.userId || !body?.role) {
    return new Response('Missing userId or role', { status: 400 });
  }

  if (!['admin', 'dj', 'user'].includes(body.role)) {
    return new Response('Invalid role', { status: 400 });
  }

  await setUserRole(body.userId, body.role);

  return new Response(JSON.stringify({ ok: true, userId: body.userId, role: body.role }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
