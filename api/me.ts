import { requireAccessToken } from './_jwtAuth';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  try {
    const payload = await requireAccessToken(req);
    return new Response(JSON.stringify({
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return new Response(message, { status });
  }
}
