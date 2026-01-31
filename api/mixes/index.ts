import { requireAccessToken, requireRole } from '../_jwtAuth';
import { addMixToIndexes, listPublishedMixes, saveMix, Mix } from './_store';
import { rateLimit } from '../_rateLimit';
import { jsonError, jsonResponse } from '../_http';
import { logEvent } from '../_log';
import { withRequestLogging } from '../_observability';

export const config = { runtime: 'edge' };

type CreateBody = {
  title: string;
  description?: string;
  audioUrl: string;
  coverUrl?: string;
  tags?: string[];
};

function badRequest(code: string, message: string) {
  return jsonError(400, code, message);
}

export default async function handler(req: Request) {
  return withRequestLogging(req, 'mixes.index', async () => {
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
        return badRequest('invalid_json', 'Invalid JSON');
      }

      if (!body?.title || !body?.audioUrl) {
        return badRequest('missing_fields', 'Missing title or audioUrl');
      }

      if (body.title.length > 120) {
        return badRequest('title_too_long', 'Title too long');
      }

      if (body.description && body.description.length > 2000) {
        return badRequest('description_too_long', 'Description too long');
      }

      if (body.tags && body.tags.length > 10) {
        return badRequest('too_many_tags', 'Too many tags');
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

      logEvent({ name: 'mix.create', meta: { mixId: mix.id, userId: mix.ownerId } });

      return jsonResponse(mix, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unauthorized';
      const status = message === 'Forbidden' ? 403 : 401;
      return jsonError(status, 'unauthorized', message);
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
      return jsonResponse(mixes, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unauthorized';
      const status = message === 'Forbidden' ? 403 : 401;
      return jsonError(status, 'unauthorized', message);
    }
  }

  return jsonError(405, 'method_not_allowed', 'Method Not Allowed');
  });
}
