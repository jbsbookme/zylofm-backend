type HeadersInitRecord = Record<string, string>;

export function securityHeaders(): HeadersInitRecord {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Cross-Origin-Resource-Policy': 'same-site',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  };
}

export function jsonResponse(
  data: unknown,
  status = 200,
  headers: HeadersInitRecord = {},
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...securityHeaders(), ...headers },
  });
}

export function jsonResponse(
  data: unknown,
  status = 200,
  headers: HeadersInitRecord = {},
  origin?: string | null,
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...securityHeaders(),
      ...corsHeaders(origin),
      ...headers,
    },
  });
}
