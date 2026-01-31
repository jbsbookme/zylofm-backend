import { kvDel } from '../_kv';
import { clearRefreshCookie, getCookie, verifyJwt } from '../_jwt';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

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
