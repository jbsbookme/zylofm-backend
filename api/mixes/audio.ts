import { requireAccessToken } from '../_jwtAuth';
import { getMix, saveMix } from './_store';
import { kvGet } from '../_kv';
import { rateLimit } from '../_rateLimit';

export const config = { runtime: 'edge' };

type Body = {
  mixId: string;
  audioPublicId: string;
};

function badRequest(message: string) {
  return new Response(message, { status: 400 });
}

export default async function handler(req: Request) {
  if (req.method !== 'PATCH') {
    return new Response('Method Not Allowed', { status: 405 });
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
    return new Response(message, { status });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return badRequest('Invalid JSON');
  }

  if (!body?.mixId || !body?.audioPublicId) {
    return badRequest('Missing mixId or audioPublicId');
  }

  const mix = await getMix(body.mixId);
  if (!mix) {
    return new Response('Mix not found', { status: 404 });
  }

  const isAdmin = payload.role === 'admin';
  if (!isAdmin && mix.ownerId !== payload.sub) {
    return new Response('Forbidden', { status: 403 });
  }

  const uploadRaw = await kvGet(`upload:audio:${body.audioPublicId}`);
  if (!uploadRaw) {
    return new Response('Audio upload not found', { status: 404 });
  }

  const upload = typeof uploadRaw === 'string' ? JSON.parse(uploadRaw) : uploadRaw;
  if (!upload?.secure_url) {
    return new Response('Invalid upload data', { status: 400 });
  }

  mix.audioPublicId = body.audioPublicId;
  mix.audioUrl = upload.secure_url as string;
  mix.duration = typeof upload.duration === 'number' ? upload.duration : null;
  mix.updatedAt = new Date().toISOString();

  await saveMix(mix);

  return new Response(JSON.stringify(mix), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
