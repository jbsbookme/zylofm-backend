import { requireAccessToken } from '../../_jwtAuth';
import { jsonError, jsonResponse } from '../../_http';
import { withRequestLogging } from '../../_observability';
import { CancelSubscriptionRequest } from '../../_billing';
import { env } from '../../_env';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  return withRequestLogging(req, 'billing.subscription.cancel', async () => {
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

    let body: CancelSubscriptionRequest;
    try {
      body = (await req.json()) as CancelSubscriptionRequest;
    } catch {
      return jsonError(400, 'invalid_json', 'Invalid JSON');
    }

    if (!body?.subscription_id) {
      return jsonError(400, 'missing_fields', 'Missing subscription_id');
    }

    return jsonResponse({ ok: true, mode: 'stub' }, 200);
  });
}
