import { requireRole } from '../_jwtAuth';
import { getCloudinaryConfig, signCloudinaryParams } from '../_cloudinary';
import { ALLOWED_AUDIO_FORMATS, ALLOWED_AUDIO_MIME, MAX_AUDIO_BYTES } from './_audioConfig';
import { rateLimit } from '../_rateLimit';
import { env } from '../_env';
import { jsonError, jsonResponse } from '../_http';
import { withRequestLogging } from '../_observability';
import { recordEvent, recordUploadStarted } from '../_analytics';
import { isPlanDenied, requirePlanForUploadStart } from '../_plan';

export const config = { runtime: 'edge' };

type Body = {
  filename?: string;
  contentType?: string;
  size?: number;
};

async function badRequest(code: string, message: string, reason?: string) {
  if (reason) {
    await recordEvent('upload_failed', { reason });
  }
  return jsonError(400, code, message);
}

export default async function handler(req: Request) {
  return withRequestLogging(req, 'uploads.audio', async () => {
  if (req.method !== 'POST') {
    return jsonError(405, 'method_not_allowed', 'Method Not Allowed');
  }

  if (env.FEATURE_UPLOADS === 'false') {
    return jsonError(503, 'uploads_disabled', 'Uploads are disabled');
  }

  try {
    const payload = await requireRole(req, ['dj']);
    const rl = await rateLimit(req, {
      keyPrefix: 'uploads-audio',
      limit: 20,
      windowSeconds: 60,
      userId: payload.sub,
    });
    if (rl) return rl;

    const planCheck = await requirePlanForUploadStart(payload.sub, payload.role as string | undefined);
    if (isPlanDenied(planCheck)) return planCheck.response;
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

  const contentType = body.contentType?.toLowerCase();
  const size = body.size ?? 0;

  if (!contentType || !ALLOWED_AUDIO_MIME.includes(contentType)) {
    return await badRequest('invalid_content_type', 'Invalid contentType', 'invalid_content_type');
  }

  if (!size || size > MAX_AUDIO_BYTES) {
    return await badRequest('invalid_size', 'Invalid size', 'invalid_size');
  }

  await recordEvent('upload_started');
  await recordUploadStarted();

  const { cloudName, apiKey } = getCloudinaryConfig();

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'zylo/audio';
  const publicId = crypto.randomUUID();

  const signatureParams: Record<string, string | number> = {
    timestamp,
    folder,
    public_id: publicId,
    resource_type: 'video',
    allowed_formats: ALLOWED_AUDIO_FORMATS.join(','),
  };

  const signature = await signCloudinaryParams(signatureParams);

  return jsonResponse(
    {
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
      fields: {
        api_key: apiKey,
        timestamp,
        signature,
        folder,
        public_id: publicId,
        resource_type: 'video',
        allowed_formats: ALLOWED_AUDIO_FORMATS.join(','),
      },
      maxBytes: MAX_AUDIO_BYTES,
      contentTypes: ALLOWED_AUDIO_MIME,
      duration: null,
    },
    200,
  );
  });
}
