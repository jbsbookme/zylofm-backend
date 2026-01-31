import { requireRole } from '../_jwtAuth';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  try {
    await requireRole(req, ['admin']);
    return new Response(JSON.stringify({ ok: true, scope: 'admin' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return new Response(message, { status });
  }
}
