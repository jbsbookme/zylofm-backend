import { requireAccessToken } from './_jwtAuth';
import { jsonError, jsonResponse } from './_http';
import { withRequestLogging } from './_observability';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  return withRequestLogging(req, 'me', async () => {
  try {
    const payload = await requireAccessToken(req);
    return jsonResponse({
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return jsonError(status, 'unauthorized', message);
  }
  });
}
