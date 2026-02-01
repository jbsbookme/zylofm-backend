import { jsonError, jsonResponse } from '../_http';
import { withRequestLogging } from '../_observability';
import { env } from '../_env';
import { applySubscriptionUpdate, checkIdempotency, validatePlan, validateStatus, WebhookEvent } from '../_billing';

const encoder = new TextEncoder();

async function hmacSha256(secret: string, data: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  return withRequestLogging(req, 'billing.webhook', async () => {
    if (req.method !== 'POST') {
      return jsonError(405, 'method_not_allowed', 'Method Not Allowed');
    }

    const secret = env.BILLING_WEBHOOK_SECRET;
    if (!secret) {
      return jsonError(503, 'webhook_unconfigured', 'Webhook secret not configured');
    }

    const signature = req.headers.get('x-webhook-signature');
    const bodyText = await req.text();
    const expected = await hmacSha256(secret, bodyText);
    if (!signature || signature !== expected) {
      return jsonError(401, 'invalid_signature', 'Invalid signature');
    }

    let event: WebhookEvent;
    try {
      event = JSON.parse(bodyText) as WebhookEvent;
    } catch {
      return jsonError(400, 'invalid_json', 'Invalid JSON');
    }

    if (!event?.event_id || !event?.userId || !event?.plan || !event?.status || !event?.subscription_id) {
      return jsonError(400, 'missing_fields', 'Missing required fields');
    }

    if (!validatePlan(event.plan) || !validateStatus(event.status)) {
      return jsonError(400, 'invalid_fields', 'Invalid plan or status');
    }

    const idem = await checkIdempotency(event.event_id);
    if (!idem.ok) return idem.response;

    await applySubscriptionUpdate(
      event.userId,
      event.plan,
      event.status,
      event.subscription_id,
      event.plan_expires_at ?? null,
    );

    return jsonResponse({ ok: true }, 200);
  });
}
