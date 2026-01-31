import { requireRole } from '../_jwtAuth';
import { getCloudinaryConfig, signCloudinaryParams } from '../_cloudinary';
import { ALLOWED_AUDIO_FORMATS, ALLOWED_AUDIO_MIME, MAX_AUDIO_BYTES } from './_audioConfig';

export const config = { runtime: 'edge' };

type Body = {
  filename?: string;
  contentType?: string;
  size?: number;
};

function badRequest(message: string) {
  return new Response(message, { status: 400 });
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    await requireRole(req, ['dj']);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return new Response(message, { status });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return badRequest('Invalid JSON');
  }

  const contentType = body.contentType?.toLowerCase();
  const size = body.size ?? 0;

  if (!contentType || !ALLOWED_AUDIO_MIME.includes(contentType)) {
    return badRequest('Invalid contentType');
  }

  if (!size || size > MAX_AUDIO_BYTES) {
    return badRequest('Invalid size');
  }

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

  return new Response(
    JSON.stringify({
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
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}
