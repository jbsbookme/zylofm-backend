import { kvDel, kvGet, kvGetDel, kvSet } from '../_kv';
import { getCookie, signJwt, verifyJwt, setRefreshCookie, clearRefreshCookie } from '../_jwt';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from './_config';
import { resolveUserRole, Role } from '../_roles';
import { rateLimit } from '../_rateLimit';
import { jsonError, jsonResponse } from '../_http';
import { withRequestLogging } from '../_observability';

export const config = { runtime: 'edge' };

type RefreshBody = { refresh_token?: string };

export default async function handler(req: Request) {
  return withRequestLogging(req, 'auth.refresh', async () => {
  if (req.method !== 'POST') {
    return jsonError(405, 'method_not_allowed', 'Method Not Allowed');
  }

  const rl = await rateLimit(req, { keyPrefix: 'auth-refresh', limit: 30, windowSeconds: 60 });
  if (rl) return rl;

  let body: RefreshBody = {};
  try {
    body = (await req.json()) as RefreshBody;
  } catch {
    body = {};
  }

  const token = getCookie(req, 'refresh_token') || body.refresh_token;
  if (!token) {
    return jsonError(401, 'missing_refresh_token', 'Missing refresh token');
  }

  let payload;
  try {
    payload = await verifyJwt(token);
  } catch {
    return jsonError(401, 'invalid_refresh_token', 'Invalid refresh token');
  }

  if (payload.type !== 'refresh') {
    return jsonError(401, 'invalid_refresh_token', 'Invalid refresh token');
  }

  const sessionKey = `session:${payload.sid}`;
  const sessionRaw = await kvGet(sessionKey);
  if (!sessionRaw) {
    return jsonError(401, 'session_revoked', 'Session revoked');
  }

  const jtiKey = `rt:${payload.jti}`;
  const jtiValue = await kvGetDel(jtiKey);
  if (!jtiValue) {
    await kvDel(sessionKey);
    return jsonError(401, 'refresh_reuse', 'Refresh token reuse detected', {
      'Set-Cookie': clearRefreshCookie(),
    });
  }

  const session = typeof sessionRaw === 'string' ? JSON.parse(sessionRaw) : sessionRaw;
  const userId = session.sub as string;
  const email = session.email as string | undefined;
  const role = session.role as string | undefined;
  const effectiveRole = await resolveUserRole(userId, (role as Role) || 'user');

  const newSessionId = payload.sid;
  const newRefreshJti = crypto.randomUUID();

  await kvSet(
    `rt:${newRefreshJti}`,
    JSON.stringify({ sid: newSessionId, sub: userId }),
    REFRESH_TOKEN_TTL_SECONDS,
  );

  const accessToken = await signJwt(
    {
      sub: userId,
      email,
      role: effectiveRole,
      type: 'access',
      jti: crypto.randomUUID(),
      sid: newSessionId,
    },
    ACCESS_TOKEN_TTL_SECONDS,
  );

  const refreshToken = await signJwt(
    {
      sub: userId,
      type: 'refresh',
      jti: newRefreshJti,
      sid: newSessionId,
    },
    REFRESH_TOKEN_TTL_SECONDS,
  );

  return jsonResponse(
    {
      access_token: accessToken,
      refresh_token: refreshToken,
    },
    200,
    {
      'Set-Cookie': setRefreshCookie(refreshToken, REFRESH_TOKEN_TTL_SECONDS),
    },
  );
  });
}
