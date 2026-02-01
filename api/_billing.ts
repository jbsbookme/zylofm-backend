import { kvGet, kvSet } from './_kv';
import { jsonError } from './_http';
import { PlanName, PlanRecord, setUserPlan } from './_plan';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';

export type CreateSubscriptionRequest = {
  plan: PlanName;
  provider: 'stripe' | 'apple' | 'google' | 'manual';
  success_url?: string;
  cancel_url?: string;
  external_sku?: string;
};

export type UpdateSubscriptionRequest = {
  subscription_id: string;
  plan: PlanName;
  status: SubscriptionStatus;
  plan_expires_at?: string | null;
};

export type CancelSubscriptionRequest = {
  subscription_id: string;
  cancel_reason?: string;
};

export type WebhookEvent = {
  event_id: string;
  type: 'subscription.updated' | 'subscription.canceled';
  userId: string;
  plan: PlanName;
  status: SubscriptionStatus;
  subscription_id: string;
  plan_expires_at?: string | null;
};

export const PLAN_SKU_MAP: Record<PlanName, Record<'stripe' | 'apple' | 'google', string>> = {
  free: {
    stripe: 'zylo_free',
    apple: 'zylo_free',
    google: 'zylo_free',
  },
  dj_pro: {
    stripe: 'zylo_dj_pro',
    apple: 'zylo_dj_pro',
    google: 'zylo_dj_pro',
  },
  admin: {
    stripe: 'zylo_admin',
    apple: 'zylo_admin',
    google: 'zylo_admin',
  },
};

export function validatePlan(plan: string): plan is PlanName {
  return plan === 'free' || plan === 'dj_pro' || plan === 'admin';
}

export function validateStatus(status: string): status is SubscriptionStatus {
  return ['trialing', 'active', 'past_due', 'canceled', 'expired'].includes(status);
}

export function isValidTransition(from: SubscriptionStatus, to: SubscriptionStatus) {
  const allowed: Record<SubscriptionStatus, SubscriptionStatus[]> = {
    trialing: ['active', 'past_due', 'canceled', 'expired'],
    active: ['past_due', 'canceled', 'expired'],
    past_due: ['active', 'canceled', 'expired'],
    canceled: [],
    expired: [],
  };
  return allowed[from].includes(to);
}

export async function applySubscriptionUpdate(
  userId: string,
  plan: PlanName,
  status: SubscriptionStatus,
  subscription_id: string,
  plan_expires_at?: string | null,
) {
  const record: PlanRecord = {
    plan,
    plan_expires_at: plan_expires_at ?? null,
    subscription_id,
    subscription_status: status,
  };
  await setUserPlan(userId, record);
}

export async function checkIdempotency(eventId: string) {
  const key = `billing:event:${eventId}`;
  const exists = await kvGet(key);
  if (exists) {
    return { ok: false, response: jsonError(200, 'idempotent', 'Event already processed') };
  }
  await kvSet(key, 1, 7 * 24 * 60 * 60);
  return { ok: true };
}
