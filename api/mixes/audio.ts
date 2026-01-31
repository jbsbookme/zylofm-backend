import { requireAccessToken } from '../_jwtAuth';
import { getMix, saveMix } from './_store';
import { kvGet } from '../_kv';
import { rateLimit } from '../_rateLimit';
import { jsonError, jsonResponse } from '../_http';
import { logEvent } from '../_log';
import { withRequestLogging } from '../_observability';

export const config = { runtime: 'edge' };

type Body = {
  mixId: string;
  audioPublicId: string;
};

function badRequest(code: string, message: string) {
  return jsonError(400, code, message);
}

export default async function handler(req: Request) {
  return withRequestLogging(req, 'mixes.audio', async () => {
  if (req.method !== 'PATCH') {
    return jsonError(405, 'method_not_allowed', 'Method Not Allowed');
  }

  let payload;
  try {
    payload = await requireAccessToken(req);
    const rl = await rateLimit(req, {
      keyPrefix: 'mixes-audio',
      limit: 30,
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

  if (!body?.mixId || !body?.audioPublicId) {
    return badRequest('missing_fields', 'Missing mixId or audioPublicId');
  }

  const mix = await getMix(body.mixId);
  if (!mix) {
    return jsonError(404, 'mix_not_found', 'Mix not found');
  }

  const isAdmin = payload.role === 'admin';
  if (!isAdmin && mix.ownerId !== payload.sub) {
    return jsonError(403, 'forbidden', 'Forbidden');
  }

  const uploadRaw = await kvGet(`upload:audio:${body.audioPublicId}`);
  if (!uploadRaw) {
    return jsonError(404, 'upload_not_found', 'Audio upload not found');
  }

  const upload = typeof uploadRaw === 'string' ? JSON.parse(uploadRaw) : uploadRaw;
  if (!upload?.secure_url) {
    return badRequest('invalid_upload', 'Invalid upload data');
  }

  if (!isAdmin && upload.userId && upload.userId !== payload.sub) {
    return jsonError(403, 'forbidden', 'Forbidden');
  }

  mix.audioPublicId = body.audioPublicId;
  mix.audioUrl = upload.secure_url as string;
  mix.duration = typeof upload.duration === 'number' ? upload.duration : null;
  mix.updatedAt = new Date().toISOString();

  await saveMix(mix);

  logEvent({
    name: 'mix.audio.linked',
    meta: { mixId: mix.id, userId: payload.sub, publicId: body.audioPublicId },
  });

  return jsonResponse(mix, 200);
  });
}
