import { requireRole } from '../_jwtAuth';
import { kvSet } from '../_kv';
import { verifyCloudinarySignature } from '../_cloudinary';
import { ALLOWED_AUDIO_FORMATS, MAX_AUDIO_BYTES } from './_audioConfig';
import { rateLimit } from '../_rateLimit';

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

function badRequest(message: string) {
  return new Response(message, { status: 400 });
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const payload = await requireRole(req, ['dj']);
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
    return new Response(message, { status });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return badRequest('Invalid JSON');
  }

  if (!body?.public_id || !body?.secure_url) {
    return badRequest('Missing public_id or secure_url');
  }

  if (!body?.signature || !body?.version) {
    return badRequest('Missing signature or version');
  }

  if (body.resource_type && body.resource_type !== 'video') {
    return badRequest('Invalid resource_type');
  }

  if (body.format && !ALLOWED_AUDIO_FORMATS.includes(body.format)) {
    return badRequest('Invalid format');
  }

  if (body.bytes && body.bytes > MAX_AUDIO_BYTES) {
    return badRequest('Invalid size');
  }

  const signatureOk = await verifyCloudinarySignature(
    { public_id: body.public_id, version: body.version },
    body.signature,
  );
  if (!signatureOk) {
    return badRequest('Invalid signature');
  }

  const payload = {
    public_id: body.public_id,
    secure_url: body.secure_url,
    duration: body.duration ?? null,
    bytes: body.bytes ?? null,
    format: body.format ?? null,
    resource_type: body.resource_type ?? 'video',
    version: body.version ?? null,
    createdAt: new Date().toISOString(),
  };

  await kvSet(`upload:audio:${body.public_id}`, payload);

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
