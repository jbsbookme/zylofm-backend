import { kvDel } from '../_kv';
import { clearRefreshCookie, getCookie, verifyJwt } from '../_jwt';
import { rateLimit } from '../_rateLimit';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const rl = await rateLimit(req, { keyPrefix: 'auth-logout', limit: 30, windowSeconds: 60 });
  if (rl) return rl;

  const token = getCookie(req, 'refresh_token');
  if (!token) {
    return new Response(null, {
      status: 204,
      headers: { 'Set-Cookie': clearRefreshCookie() },
    });
  }

  try {
    const payload = await verifyJwt(token);
    await kvDel(`session:${payload.sid}`);
    await kvDel(`rt:${payload.jti}`);
  } catch {
    // ignore invalid token
  }

  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': clearRefreshCookie() },
  });
}
