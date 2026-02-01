import { kvGet, kvSet } from './_kv';
import { jsonError } from './_http';
import { env } from './_env';

export type PlanName = 'free' | 'dj_pro' | 'admin';

export type PlanLimits = {
  mixesPerMonth: number;
  uploadsPerMonth: number;
  maxAudioSeconds: number;
};

export type PlanCheck =
  | { ok: true; plan: PlanName; limits: PlanLimits }
  | { ok: false; response: Response };

export type PlanRecord = {
  plan: PlanName;
  plan_expires_at?: string | null;
  subscription_id?: string | null;
  subscription_status?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
};

const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  free: { mixesPerMonth: 5, uploadsPerMonth: 5, maxAudioSeconds: 15 * 60 },
  dj_pro: { mixesPerMonth: 50, uploadsPerMonth: 50, maxAudioSeconds: 60 * 60 },
  admin: { mixesPerMonth: Infinity, uploadsPerMonth: Infinity, maxAudioSeconds: Infinity },
};

function monthKey(d = new Date()) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}${mm}`;
}

function ttlToMonthEndSeconds(d = new Date()) {
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  const ttlMs = end.getTime() - d.getTime();
  return Math.max(3600, Math.ceil(ttlMs / 1000) + 24 * 60 * 60);
}

async function getNumber(key: string) {
  const raw = await kvGet(key);
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

async function incrementMonthly(key: string) {
  const current = await getNumber(key);
  const next = current + 1;
  await kvSet(key, next, ttlToMonthEndSeconds());
  return next;
}

export async function getUserPlan(userId: string, role?: string): Promise<PlanRecord> {
  if (env.FEATURE_PAYMENTS === 'false') {
    return { plan: 'free' };
  }
  if (role === 'admin') return { plan: 'admin' };
  const raw = await kvGet(`userplan:${userId}`);
  if (raw && typeof raw === 'string') {
    try {
      return JSON.parse(raw) as PlanRecord;
    } catch {
      return { plan: 'free' };
    }
  }
  if (raw && typeof raw === 'object') {
    return raw as PlanRecord;
  }
  return { plan: 'free' };
}

export async function setUserPlan(userId: string, record: PlanRecord) {
  await kvSet(`userplan:${userId}`, record);
}

export function getPlanLimits(plan: PlanName) {
  return PLAN_LIMITS[plan];
}

export async function requirePlanForMixCreate(userId: string, role?: string): Promise<PlanCheck> {
  const record = await getUserPlan(userId, role);
  const limits = getPlanLimits(record.plan);

  if (!Number.isFinite(limits.mixesPerMonth)) {
    return { ok: true, plan: record.plan, limits };
  }

  const key = `plan:usage:${userId}:${monthKey()}:mixes`;
  const count = await getNumber(key);
  if (count >= limits.mixesPerMonth) {
    return {
      ok: false,
      response: jsonError(402, 'plan_limit', 'Mixes per month limit reached'),
    };
  }

  await incrementMonthly(key);
  return { ok: true, plan: record.plan, limits };
}

export async function requirePlanForUploadStart(userId: string, role?: string): Promise<PlanCheck> {
  const record = await getUserPlan(userId, role);
  const limits = getPlanLimits(record.plan);

  if (!Number.isFinite(limits.uploadsPerMonth)) {
    return { ok: true, plan: record.plan, limits };
  }

  const key = `plan:usage:${userId}:${monthKey()}:uploads`;
  const count = await getNumber(key);
  if (count >= limits.uploadsPerMonth) {
    return {
      ok: false,
      response: jsonError(402, 'plan_limit', 'Uploads per month limit reached'),
    };
  }

  await incrementMonthly(key);
  return { ok: true, plan: record.plan, limits };
}

export async function requirePlanForUploadComplete(
  userId: string,
  durationSeconds?: number | null,
  role?: string,
): Promise<PlanCheck> {
  const record = await getUserPlan(userId, role);
  const limits = getPlanLimits(record.plan);
  if (typeof durationSeconds === 'number' && Number.isFinite(durationSeconds)) {
    if (durationSeconds > limits.maxAudioSeconds) {
      return {
        ok: false,
        response: jsonError(402, 'plan_limit', 'Audio duration limit exceeded'),
      };
    }
  }
  return { ok: true, plan: record.plan, limits };
}
