import { kvDel, kvGet, kvGetDel, kvSet } from '../_kv';
import { getCookie, signJwt, verifyJwt, setRefreshCookie, clearRefreshCookie } from '../_jwt';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from './_config';

export const config = { runtime: 'edge' };

type RefreshBody = { refresh_token?: string };

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body: RefreshBody = {};
  try {
    body = (await req.json()) as RefreshBody;
  } catch {
    body = {};
  }

  const token = getCookie(req, 'refresh_token') || body.refresh_token;
  if (!token) {
    return new Response('Missing refresh token', { status: 401 });
  }

  let payload;
  try {
    payload = await verifyJwt(token);
  } catch {
    return new Response('Invalid refresh token', { status: 401 });
  }

  if (payload.type !== 'refresh') {
    return new Response('Invalid refresh token', { status: 401 });
  }

  const sessionKey = `session:${payload.sid}`;
  const sessionRaw = await kvGet(sessionKey);
  if (!sessionRaw) {
    return new Response('Session revoked', { status: 401 });
  }

  const jtiKey = `rt:${payload.jti}`;
  const jtiValue = await kvGetDel(jtiKey);
  if (!jtiValue) {
    await kvDel(sessionKey);
    return new Response('Refresh token reuse detected', {
      status: 401,
      headers: { 'Set-Cookie': clearRefreshCookie() },
    });
  }

  const session = typeof sessionRaw === 'string' ? JSON.parse(sessionRaw) : sessionRaw;
  const userId = session.sub as string;
  const email = session.email as string | undefined;
  const role = session.role as string | undefined;

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
      role,
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

  return new Response(
    JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': setRefreshCookie(refreshToken, REFRESH_TOKEN_TTL_SECONDS),
      },
    },
  );
}
