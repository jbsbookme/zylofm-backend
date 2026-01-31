import { kvSet } from '../_kv';
import { signJwt, setRefreshCookie } from '../_jwt';
import { env } from '../_env';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from './_config';

export const config = { runtime: 'edge' };

type LoginBody = {
  email: string;
  password: string;
};

type AuthUser = { id: string; email: string; role?: string };

async function authenticateUser(body: LoginBody): Promise<AuthUser> {
  const { email, password } = body;

  const bypass = env.AUTH_BYPASS === 'true';
  if (bypass) {
    return { id: email, email, role: 'user' };
  }

  const testEmail = env.AUTH_TEST_USER_EMAIL;
  const testPassword = env.AUTH_TEST_USER_PASSWORD;
  if (testEmail && testPassword) {
    if (email === testEmail && password === testPassword) {
      return {
        id: env.AUTH_TEST_USER_ID || 'test-user',
        email: testEmail,
        role: 'user',
      };
    }
  }

  throw new Error('Invalid credentials');
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!body?.email || !body?.password) {
    return new Response('Missing credentials', { status: 400 });
  }

  let user: AuthUser;
  try {
    user = await authenticateUser(body);
  } catch {
    return new Response('Invalid credentials', { status: 401 });
  }

  const sessionId = crypto.randomUUID();
  const refreshJti = crypto.randomUUID();

  await kvSet(
    `session:${sessionId}`,
    JSON.stringify({ sub: user.id, email: user.email, role: user.role }),
    REFRESH_TOKEN_TTL_SECONDS,
  );

  await kvSet(
    `rt:${refreshJti}`,
    JSON.stringify({ sid: sessionId, sub: user.id }),
    REFRESH_TOKEN_TTL_SECONDS,
  );

  const accessToken = await signJwt(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
      jti: crypto.randomUUID(),
      sid: sessionId,
    },
    ACCESS_TOKEN_TTL_SECONDS,
  );

  const refreshToken = await signJwt(
    {
      sub: user.id,
      type: 'refresh',
      jti: refreshJti,
      sid: sessionId,
    },
    REFRESH_TOKEN_TTL_SECONDS,
  );

  return new Response(
    JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
      user,
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
