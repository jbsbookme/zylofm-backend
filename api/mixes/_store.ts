import { kvGet, kvSet } from '../_kv';

export type MixStatus = 'pending' | 'published' | 'rejected';

export type Mix = {
  id: string;
  ownerId: string;
  title: string;
  description?: string;
  audioUrl: string;
  coverUrl?: string;
  tags?: string[];
  status: MixStatus;
  createdAt: string;
  updatedAt: string;
};

function parseValue<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value as T;
}

async function getList(key: string) {
  const raw = await kvGet(key);
  return (parseValue<string[]>(raw) ?? []) as string[];
}

async function setList(key: string, list: string[]) {
  await kvSet(key, list);
}

function dedupe(list: string[]) {
  return Array.from(new Set(list));
}

export async function getMix(id: string) {
  const raw = await kvGet(`mix:${id}`);
  return parseValue<Mix>(raw);
}

export async function saveMix(mix: Mix) {
  await kvSet(`mix:${mix.id}`, mix);
}

export async function addMixToIndexes(mix: Mix) {
  const allKey = 'mixes:index';
  const mineKey = `mixes:user:${mix.ownerId}`;

  const allList = dedupe([...(await getList(allKey)), mix.id]);
  const mineList = dedupe([...(await getList(mineKey)), mix.id]);

  await setList(allKey, allList);
  await setList(mineKey, mineList);
}

export async function listPublishedMixes() {
  const ids = await getList('mixes:index');
  const mixes: Mix[] = [];

  for (const id of ids) {
    const mix = await getMix(id);
    if (mix && mix.status === 'published') mixes.push(mix);
  }

  mixes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return mixes;
}

export async function listUserMixes(userId: string) {
  const ids = await getList(`mixes:user:${userId}`);
  const mixes: Mix[] = [];

  for (const id of ids) {
    const mix = await getMix(id);
    if (mix) mixes.push(mix);
  }

  mixes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return mixes;
}
