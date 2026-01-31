import { requireAccessToken } from '../_jwtAuth';
import { listUserMixes } from './_store';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const payload = await requireAccessToken(req);
    const mixes = await listUserMixes(payload.sub);
    return new Response(JSON.stringify(mixes), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return new Response(message, { status });
  }
}
