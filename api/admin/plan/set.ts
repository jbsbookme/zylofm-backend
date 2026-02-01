import { requireRole } from '../../_jwtAuth';
import { jsonError, jsonResponse } from '../../_http';
import { withRequestLogging } from '../../_observability';
import { PlanName, setUserPlan } from '../../_plan';
import { logEvent } from '../../_log';

export const config = { runtime: 'edge' };

type Body = {
  userId: string;
  plan: PlanName;
  expires_at?: string | null;
};

export default async function handler(req: Request) {
  return withRequestLogging(req, 'admin.plan.set', async () => {
    if (req.method !== 'POST') {
      return jsonError(405, 'method_not_allowed', 'Method Not Allowed');
    }

    try {
      await requireRole(req, ['admin']);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unauthorized';
      const status = message === 'Forbidden' ? 403 : 401;
      return jsonError(status, 'unauthorized', message);
    }

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return jsonError(400, 'invalid_json', 'Invalid JSON');
    }

    if (!body?.userId || !body?.plan) {
      return jsonError(400, 'missing_fields', 'Missing userId or plan');
    }

    if (!['free', 'dj_pro', 'admin'].includes(body.plan)) {
      return jsonError(400, 'invalid_plan', 'Invalid plan');
    }

    let expiresAt: string | null | undefined = body.expires_at ?? null;
    if (expiresAt) {
      const parsed = Date.parse(expiresAt);
      if (!Number.isFinite(parsed)) {
        return jsonError(400, 'invalid_expires_at', 'Invalid expires_at');
      }
      expiresAt = new Date(parsed).toISOString();
    }

    await setUserPlan(body.userId, {
      plan: body.plan,
      plan_expires_at: expiresAt,
      subscription_id: null,
    });

    logEvent({
      name: 'admin.plan.set',
      meta: { userId: body.userId, plan: body.plan, expires_at: expiresAt },
    });

    return jsonResponse({
      userId: body.userId,
      plan: body.plan,
      plan_expires_at: expiresAt,
    }, 200);
  });
}
