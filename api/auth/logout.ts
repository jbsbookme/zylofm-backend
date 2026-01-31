import { kvDel } from '../_kv';
import { clearRefreshCookie, getCookie, verifyJwt } from '../_jwt';
import { rateLimit } from '../_rateLimit';
import { jsonError, jsonResponse } from '../_http';
import { withRequestLogging } from '../_observability';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  return withRequestLogging(req, 'auth.logout', async () => {
  if (req.method !== 'POST') {
    return jsonError(405, 'method_not_allowed', 'Method Not Allowed');
  }

  const rl = await rateLimit(req, { keyPrefix: 'auth-logout', limit: 30, windowSeconds: 60 });
  if (rl) return rl;

  const token = getCookie(req, 'refresh_token');
  if (!token) {
    return jsonResponse(
      { ok: true },
      200,
      { 'Set-Cookie': clearRefreshCookie() },
    );
  }

  try {
    const payload = await verifyJwt(token);
    await kvDel(`session:${payload.sid}`);
    await kvDel(`rt:${payload.jti}`);
  } catch {
    // ignore invalid token
  }

  return jsonResponse(
    { ok: true },
    200,
    { 'Set-Cookie': clearRefreshCookie() },
  );
  });
}
