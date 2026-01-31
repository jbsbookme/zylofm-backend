import { requireRole } from '../_jwtAuth';
import { getMix, saveMix, MixStatus } from './_store';

export const config = { runtime: 'edge' };

type Body = {
  mixId: string;
  status: MixStatus;
};

function badRequest(message: string) {
  return new Response(message, { status: 400 });
}

export default async function handler(req: Request) {
  if (req.method !== 'PATCH') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    await requireRole(req, ['admin']);
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

  if (!body?.mixId || !body?.status) {
    return badRequest('Missing mixId or status');
  }

  if (!['published', 'rejected', 'pending'].includes(body.status)) {
    return badRequest('Invalid status');
  }

  const mix = await getMix(body.mixId);
  if (!mix) {
    return new Response('Mix not found', { status: 404 });
  }

  mix.status = body.status;
  mix.updatedAt = new Date().toISOString();

  await saveMix(mix);

  return new Response(JSON.stringify(mix), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
