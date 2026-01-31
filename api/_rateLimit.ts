import { kvGet, kvSet } from './_kv';
import { jsonError } from './_http';
import { incrMetric } from './_metrics';

export type RateLimitOptions = {
  keyPrefix: string;
  limit: number;
  windowSeconds: number;
  userId?: string;
};

type Bucket = { count: number; resetAt: number };

function getClientIp(req: Request) {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

function parseBucket(value: unknown): Bucket | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Bucket;
    } catch {
      return null;
    }
  }
  return value as Bucket;
}

export async function rateLimit(req: Request, opts: RateLimitOptions) {
  const ip = getClientIp(req);
  const key = `rl:${opts.keyPrefix}:${ip}:${opts.userId || 'anon'}`;
  const now = Date.now();

  const raw = await kvGet(key);
  const bucket = parseBucket(raw);

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + opts.windowSeconds * 1000;
    const next: Bucket = { count: 1, resetAt };
    await kvSet(key, next, opts.windowSeconds);
    return null;
  }

  if (bucket.count >= opts.limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    await incrMetric(`metrics:ratelimit:${opts.keyPrefix}`);
    return jsonError(429, 'rate_limited', 'Too Many Requests', {
      'Retry-After': retryAfter.toString(),
      'X-RateLimit-Limit': opts.limit.toString(),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': Math.ceil(bucket.resetAt / 1000).toString(),
    });
  }

  const updated: Bucket = { count: bucket.count + 1, resetAt: bucket.resetAt };
  const ttlSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  await kvSet(key, updated, ttlSeconds);

  return null;
}
