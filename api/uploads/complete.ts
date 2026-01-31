import { requireRole } from '../_jwtAuth';
import { kvSet } from '../_kv';
import { verifyCloudinarySignature } from '../_cloudinary';
import { ALLOWED_AUDIO_FORMATS, MAX_AUDIO_BYTES } from './_audioConfig';
import { rateLimit } from '../_rateLimit';
import { env } from '../_env';
import { jsonError, jsonResponse } from '../_http';
import { logEvent } from '../_log';
import { withRequestLogging } from '../_observability';
import { recordEvent, recordUploadCompleted, recordUploadFailed } from '../_analytics';

export const config = { runtime: 'edge' };

type Body = {
  public_id?: string;
  secure_url?: string;
  duration?: number;
  bytes?: number;
  format?: string;
  resource_type?: string;
  signature?: string;
  version?: number;
};

async function badRequest(code: string, message: string, reason?: string) {
  if (reason) {
    await recordUploadFailed(reason);
    await recordEvent('upload_failed', { reason });
  }
  return jsonError(400, code, message);
}

export default async function handler(req: Request) {
  return withRequestLogging(req, 'uploads.complete', async () => {
  if (req.method !== 'POST') {
    return jsonError(405, 'method_not_allowed', 'Method Not Allowed');
  }

  if (env.FEATURE_UPLOADS === 'false') {
    return jsonError(503, 'uploads_disabled', 'Uploads are disabled');
  }

  let payload;
  try {
    payload = await requireRole(req, ['dj']);
    const rl = await rateLimit(req, {
      keyPrefix: 'uploads-complete',
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
    return await badRequest('invalid_json', 'Invalid JSON', 'invalid_json');
  }

  if (!body?.public_id || !body?.secure_url) {
    return await badRequest('missing_fields', 'Missing public_id or secure_url', 'missing_fields');
  }

  if (!body?.signature || !body?.version) {
    return await badRequest('missing_signature', 'Missing signature or version', 'missing_signature');
  }

  if (body.resource_type && body.resource_type !== 'video') {
    return await badRequest('invalid_resource_type', 'Invalid resource_type', 'invalid_resource_type');
  }

  if (body.format && !ALLOWED_AUDIO_FORMATS.includes(body.format)) {
    return await badRequest('invalid_format', 'Invalid format', 'invalid_format');
  }

  if (body.bytes && body.bytes > MAX_AUDIO_BYTES) {
    return await badRequest('invalid_size', 'Invalid size', 'invalid_size');
  }

  const signatureOk = await verifyCloudinarySignature(
    { public_id: body.public_id, version: body.version },
    body.signature,
  );
  if (!signatureOk) {
    return await badRequest('invalid_signature', 'Invalid signature', 'invalid_signature');
  }

  const data = {
    public_id: body.public_id,
    secure_url: body.secure_url,
    duration: body.duration ?? null,
    bytes: body.bytes ?? null,
    format: body.format ?? null,
    resource_type: body.resource_type ?? 'video',
    version: body.version ?? null,
    userId: payload.sub,
    createdAt: new Date().toISOString(),
  };

  await kvSet(`upload:audio:${body.public_id}`, data);

  logEvent({
    name: 'upload.audio.complete',
    meta: { userId: payload.sub, publicId: body.public_id, bytes: body.bytes },
  });

  await recordEvent('upload_completed', { publicId: body.public_id });
  await recordUploadCompleted();

  return jsonResponse(data, 200);
  });
}
