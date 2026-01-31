import { requireAccessToken } from '../_jwtAuth';
import { listUserMixes } from './_store';
import { rateLimit } from '../_rateLimit';
import { jsonError, jsonResponse } from '../_http';
import { withRequestLogging } from '../_observability';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  return withRequestLogging(req, 'mixes.mine', async () => {
  if (req.method !== 'GET') {
    return jsonError(405, 'method_not_allowed', 'Method Not Allowed');
  }

  try {
    const payload = await requireAccessToken(req);
    const rl = await rateLimit(req, {
      keyPrefix: 'mixes-mine',
      limit: 60,
      windowSeconds: 60,
      userId: payload.sub,
    });
    if (rl) return rl;
    const mixes = await listUserMixes(payload.sub);
    return jsonResponse(mixes, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return jsonError(status, 'unauthorized', message);
  }
  });
}
