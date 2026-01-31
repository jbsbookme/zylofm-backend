import { requireRole } from '../_jwtAuth';
import { getMix, saveMix, MixStatus } from './_store';
import { rateLimit } from '../_rateLimit';
import { jsonError, jsonResponse } from '../_http';
import { logEvent } from '../_log';
import { withRequestLogging } from '../_observability';
import { recordEvent, recordMixPublished } from '../_analytics';

export const config = { runtime: 'edge' };

type Body = {
  mixId: string;
  status: MixStatus;
};

function badRequest(code: string, message: string) {
  return jsonError(400, code, message);
}

export default async function handler(req: Request) {
  return withRequestLogging(req, 'mixes.admin', async () => {
  if (req.method !== 'PATCH') {
    return jsonError(405, 'method_not_allowed', 'Method Not Allowed');
  }

  try {
    const payload = await requireRole(req, ['admin']);
    const rl = await rateLimit(req, {
      keyPrefix: 'mixes-admin',
      limit: 60,
      windowSeconds: 60,
      userId: payload.sub,
    });
    if (rl) return rl;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return jsonError(status, 'unauthorized', message);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return badRequest('invalid_json', 'Invalid JSON');
  }

  if (!body?.mixId || !body?.status) {
    return badRequest('missing_fields', 'Missing mixId or status');
  }

  if (!['published', 'rejected', 'pending'].includes(body.status)) {
    return badRequest('invalid_status', 'Invalid status');
  }

  const mix = await getMix(body.mixId);
  if (!mix) {
    return jsonError(404, 'mix_not_found', 'Mix not found');
  }

  const previousStatus = mix.status;

  mix.status = body.status;
  mix.updatedAt = new Date().toISOString();

  await saveMix(mix);

  logEvent({
    name: 'mix.moderate',
    meta: { mixId: mix.id, status: mix.status },
  });

  if (mix.status === 'published' && previousStatus !== 'published') {
    const createdAt = Date.parse(mix.createdAt);
    const publishedAt = Date.now();
    const seconds = Number.isFinite(createdAt)
      ? Math.max(0, Math.floor((publishedAt - createdAt) / 1000))
      : undefined;
    await recordEvent('mix_published', { mixId: mix.id });
    await recordMixPublished(seconds);
  }

  return jsonResponse(mix, 200);
  });
}
