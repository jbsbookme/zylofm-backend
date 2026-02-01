import { requireAccessToken } from '../../_jwtAuth';
import { jsonError, jsonResponse } from '../../_http';
import { withRequestLogging } from '../../_observability';
import { CreateSubscriptionRequest, PLAN_SKU_MAP, validatePlan } from '../../_billing';
import { env } from '../../_env';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  return withRequestLogging(req, 'billing.subscription.create', async () => {
    if (req.method !== 'POST') {
      return jsonError(405, 'method_not_allowed', 'Method Not Allowed');
    }

    if (env.FEATURE_PAYMENTS === 'false') {
      return jsonError(403, 'payments_disabled', 'Payments are disabled');
    }

    try {
      await requireAccessToken(req);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unauthorized';
      const status = message === 'Forbidden' ? 403 : 401;
      return jsonError(status, 'unauthorized', message);
    }

    let body: CreateSubscriptionRequest;
    try {
      body = (await req.json()) as CreateSubscriptionRequest;
    } catch {
      return jsonError(400, 'invalid_json', 'Invalid JSON');
    }

    if (!body?.plan || !body?.provider) {
      return jsonError(400, 'missing_fields', 'Missing plan or provider');
    }

    if (!validatePlan(body.plan)) {
      return jsonError(400, 'invalid_plan', 'Invalid plan');
    }

    const sku = body.external_sku || PLAN_SKU_MAP[body.plan][body.provider === 'manual' ? 'stripe' : body.provider];

    return jsonResponse({
      ok: true,
      mode: 'stub',
      plan: body.plan,
      provider: body.provider,
      sku,
      subscription_intent_id: crypto.randomUUID(),
    }, 200);
  });
}
