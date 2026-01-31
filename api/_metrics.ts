import { kvGet, kvSet } from './_kv';

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function incrMetric(key: string, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const raw = await kvGet(key);
  const current = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : 0;
  const next = Number.isFinite(current) ? current + 1 : 1;
  await kvSet(key, next, ttlSeconds);
  return next;
}
