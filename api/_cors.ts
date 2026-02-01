const ALLOWED_ORIGINS = [
  "https://www.jblatinmusic.net",
  "https://jblatinmusic.net",
  "http://localhost:3000",
];

export function corsHeaders(origin?: string) {
  const allow =
    origin && ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

export function handleOptions(req: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin") ?? undefined),
  });
}