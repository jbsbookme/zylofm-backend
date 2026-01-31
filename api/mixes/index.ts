import { requireAccessToken, requireRole } from '../_jwtAuth';
import { addMixToIndexes, listPublishedMixes, saveMix, Mix } from './_store';
import { rateLimit } from '../_rateLimit';

export const config = { runtime: 'edge' };

type CreateBody = {
  title: string;
  description?: string;
  audioUrl: string;
  coverUrl?: string;
  tags?: string[];
};

function badRequest(message: string) {
  return new Response(message, { status: 400 });
}

export default async function handler(req: Request) {
  if (req.method === 'POST') {
    try {
      const payload = await requireRole(req, ['dj']);
      const rl = await rateLimit(req, {
        keyPrefix: 'mixes-create',
        limit: 10,
        windowSeconds: 60,
        userId: payload.sub,
      });
      if (rl) return rl;

      let body: CreateBody;
      try {
        body = (await req.json()) as CreateBody;
      } catch {
        return badRequest('Invalid JSON');
      }

      if (!body?.title || !body?.audioUrl) {
        return badRequest('Missing title or audioUrl');
      }

      const now = new Date().toISOString();
      const mix: Mix = {
        id: crypto.randomUUID(),
        ownerId: payload.sub,
        title: body.title.trim(),
        description: body.description?.trim() || undefined,
        audioUrl: body.audioUrl.trim(),
        audioPublicId: undefined,
        duration: null,
        coverUrl: body.coverUrl?.trim() || undefined,
        tags: body.tags || [],
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };

      await saveMix(mix);
      await addMixToIndexes(mix);

      return new Response(JSON.stringify(mix), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unauthorized';
      const status = message === 'Forbidden' ? 403 : 401;
      return new Response(message, { status });
    }
  }

  if (req.method === 'GET') {
    try {
      const payload = await requireAccessToken(req);
      const rl = await rateLimit(req, {
        keyPrefix: 'mixes-list',
        limit: 60,
        windowSeconds: 60,
        userId: payload.sub,
      });
      if (rl) return rl;
      const mixes = await listPublishedMixes();
      return new Response(JSON.stringify(mixes), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unauthorized';
      const status = message === 'Forbidden' ? 403 : 401;
      return new Response(message, { status });
    }
  }

  return new Response('Method Not Allowed', { status: 405 });
}
