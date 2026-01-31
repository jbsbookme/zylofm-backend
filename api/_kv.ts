import { env } from './_env';

export type KvValue = string | number | boolean | object | null;

type KvResult<T> = { result: T | null; error?: string };

const KV_REST_API_URL = env.KV_REST_API_URL;
const KV_REST_API_TOKEN = env.KV_REST_API_TOKEN;

const memoryKv = new Map<string, { value: KvValue; expiresAt: number | null }>();

function nowMs() {
  return Date.now();
}

function isExpired(entry: { expiresAt: number | null }) {
  return entry.expiresAt !== null && entry.expiresAt <= nowMs();
}

async function kvFetch<T>(command: unknown[]): Promise<KvResult<T>> {
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    return { result: null, error: 'KV not configured' };
  }

  const res = await fetch(KV_REST_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });

  const data = (await res.json()) as KvResult<T>;
  return data;
}

export async function kvGet(key: string): Promise<KvValue | null> {
  if (KV_REST_API_URL && KV_REST_API_TOKEN) {
    const { result } = await kvFetch<KvValue>(['GET', key]);
    return result ?? null;
  }

  const entry = memoryKv.get(key);
  if (!entry) return null;
  if (isExpired(entry)) {
    memoryKv.delete(key);
    return null;
  }
  return entry.value;
}

export async function kvSet(key: string, value: KvValue, ttlSeconds?: number) {
  if (KV_REST_API_URL && KV_REST_API_TOKEN) {
    if (ttlSeconds) {
      await kvFetch(['SET', key, JSON.stringify(value), 'EX', ttlSeconds]);
    } else {
      await kvFetch(['SET', key, JSON.stringify(value)]);
    }
    return;
  }

  const expiresAt = ttlSeconds ? nowMs() + ttlSeconds * 1000 : null;
  memoryKv.set(key, { value, expiresAt });
}

export async function kvDel(key: string) {
  if (KV_REST_API_URL && KV_REST_API_TOKEN) {
    await kvFetch(['DEL', key]);
    return;
  }

  memoryKv.delete(key);
}

export async function kvGetDel(key: string): Promise<KvValue | null> {
  if (KV_REST_API_URL && KV_REST_API_TOKEN) {
    const { result } = await kvFetch<KvValue>(['GETDEL', key]);
    return result ?? null;
  }

  const value = await kvGet(key);
  if (value !== null) await kvDel(key);
  return value;
}
