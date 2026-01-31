import { kvGet, kvSet } from './_kv';
import { incrMetric } from './_metrics';
import { logEvent } from './_log';

function dateKey(d = new Date()) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

const DEFAULT_TTL_SECONDS = 32 * 24 * 60 * 60;

export async function recordEvent(name: string, meta: Record<string, unknown> = {}) {
  logEvent({ name, meta });
  const key = `metrics:event:${name}:${dateKey()}`;
  await incrMetric(key, DEFAULT_TTL_SECONDS);
}

export async function recordActiveDj(userId: string) {
  const day = dateKey();
  const uniqueKey = `metrics:active_dj:${day}:user:${userId}`;
  const exists = await kvGet(uniqueKey);
  if (!exists) {
    await kvSet(uniqueKey, 1, DEFAULT_TTL_SECONDS);
    await incrMetric(`metrics:active_dj:${day}`);
  }
}

export async function recordMixCreated() {
  await incrMetric(`metrics:mix_created:${dateKey()}`, DEFAULT_TTL_SECONDS);
}

export async function recordMixPublished(timeToPublishSeconds?: number) {
  const day = dateKey();
  await incrMetric(`metrics:mix_published:${day}`, DEFAULT_TTL_SECONDS);
  if (typeof timeToPublishSeconds === 'number' && Number.isFinite(timeToPublishSeconds)) {
    await incrMetric(`metrics:time_to_publish_count:${day}`, DEFAULT_TTL_SECONDS);
    const sumKey = `metrics:time_to_publish_sum:${day}`;
    const raw = await kvGet(sumKey);
    const current = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : 0;
    const next = Number.isFinite(current) ? current + timeToPublishSeconds : timeToPublishSeconds;
    await kvSet(sumKey, next, DEFAULT_TTL_SECONDS);
  }
}

export async function recordUploadStarted() {
  await incrMetric(`metrics:upload_started:${dateKey()}`, DEFAULT_TTL_SECONDS);
}

export async function recordUploadCompleted() {
  await incrMetric(`metrics:upload_completed:${dateKey()}`, DEFAULT_TTL_SECONDS);
}

export async function recordUploadFailed(reason?: string) {
  await incrMetric(`metrics:upload_failed:${dateKey()}`, DEFAULT_TTL_SECONDS);
  if (reason) {
    await incrMetric(`metrics:upload_failed:${reason}:${dateKey()}`, DEFAULT_TTL_SECONDS);
  }
}
