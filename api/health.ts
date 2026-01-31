import { jsonResponse } from './_http';
import { withRequestLogging } from './_observability';

export const config = { runtime: 'edge' };

export default function handler(req: Request) {
  return withRequestLogging(req, 'health', async () => {
    return jsonResponse({ ok: true }, 200);
  });
}
