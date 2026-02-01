import { requireAccessToken } from '../_jwtAuth';
import { jsonError, jsonResponse } from '../_http';
import { getPlanLimits, getUserPlan } from '../_plan';
import { withRequestLogging } from '../_observability';
import { env } from '../_env';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  return withRequestLogging(req, 'billing.status', async () => {
    if (req.method !== 'GET') {
      return jsonError(405, 'method_not_allowed', 'Method Not Allowed');
    }

    try {
      const payload = await requireAccessToken(req);
      if (env.FEATURE_PAYMENTS === 'false') {
        const limits = getPlanLimits('free');
        return jsonResponse({
          plan: 'free',
          plan_expires_at: null,
          subscription_id: null,
          subscription_status: null,
          limits,
        }, 200);
      }

      const plan = await getUserPlan(payload.sub, payload.role as string | undefined);
      const limits = getPlanLimits(plan.plan);

      return jsonResponse({
        plan: plan.plan,
        plan_expires_at: plan.plan_expires_at ?? null,
        subscription_id: plan.subscription_id ?? null,
        subscription_status: plan.subscription_status ?? null,
        limits,
      }, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unauthorized';
      const status = message === 'Forbidden' ? 403 : 401;
      return jsonError(status, 'unauthorized', message);
    }
  });
}
