import { handleOptions } from '../_cors';
import { requireRole } from '../_jwtAuth';
import { getMix, saveMix, MixStatus } from './_store';
import { rateLimit } from '../_rateLimit';
import { jsonError, jsonResponse } from '../_http';
import { logEvent } from '../_log';
import { withRequestLogging } from '../_observability';
import { recordEvent, recordMixPublished } from '../_analytics';

export const config = { runtime: 'edge' };

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

type Body = {
  mixId: string;
  status: MixStatus;
};

export const POST = withRequestLogging(async (req: Request) => {
  const origin = req.headers.get('origin');

  await rateLimit(req);
  await requireRole(req, ['admin']);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'bad_request', 'Invalid JSON body', {}, origin);
  }

  const mix = await getMix(body.mixId);
  if (!mix) {
    return jsonError(404, 'not_found', 'Mix not found', {}, origin);
  }

  mix.status = body.status;
  await saveMix(mix);

  if (body.status === 'published') {
    recordMixPublished(mix);
  }

  recordEvent('mix_status_updated', { mixId: body.mixId, status: body.status });
  logEvent('mix_admin_update', { mixId: body.mixId, status: body.status });

  return jsonResponse({ ok: true, mix }, 200, {}, origin);
});