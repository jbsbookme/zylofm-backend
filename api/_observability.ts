import { incrMetric } from './_metrics';

function getPath(req: Request) {
  try {
    const url = new URL(req.url);
    return url.pathname;
  } catch {
    return req.url;
  }
}

function getRequestId(req: Request) {
  return req.headers.get('x-request-id') || crypto.randomUUID();
}

export async function withRequestLogging(
  req: Request,
  endpoint: string,
  handler: () => Promise<Response>,
) {
  const requestId = getRequestId(req);
  const start = Date.now();

  let res: Response;
  try {
    res = await handler();
  } catch (err) {
    await incrMetric(`metrics:errors:${endpoint}`);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    res = new Response(JSON.stringify({ error: { code: 'internal_error', message } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const durationMs = Date.now() - start;
  const status = res.status;
  const path = getPath(req);

  if (status >= 400) {
    await incrMetric(`metrics:errors:${endpoint}`);
  }

  console.log(
    JSON.stringify({
      requestId,
      method: req.method,
      path,
      status,
      durationMs,
    }),
  );

  const headers = new Headers(res.headers);
  headers.set('x-request-id', requestId);

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}
