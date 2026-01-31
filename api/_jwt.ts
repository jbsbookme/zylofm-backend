import { env } from './_env';

type JwtType = 'access' | 'refresh';

export type JwtPayload = {
  sub: string;
  email?: string;
  role?: string;
  type: JwtType;
  jti: string;
  sid: string;
  iat: number;
  exp: number;
};

const encoder = new TextEncoder();

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function base64UrlEncode(input: string | Uint8Array) {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input;
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  const base64 = btoa(binary);
  return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecodeToBytes(input: string) {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function hmacSign(secret: string, data: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64UrlEncode(new Uint8Array(signature));
}

async function hmacVerify(secret: string, data: string, signatureB64Url: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const signature = base64UrlDecodeToBytes(signatureB64Url);
  return crypto.subtle.verify('HMAC', key, signature, encoder.encode(data));
}

export function getJwtSecret() {
  const secret = env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

export async function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>, ttlSeconds: number) {
  const iat = nowSeconds();
  const exp = iat + ttlSeconds;
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload: JwtPayload = { ...payload, iat, exp };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${headerB64}.${payloadB64}`;
  const signature = await hmacSign(getJwtSecret(), data);
  return `${data}.${signature}`;
}

export async function verifyJwt(token: string) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const [headerB64, payloadB64, signature] = parts;
  const data = `${headerB64}.${payloadB64}`;
  const ok = await hmacVerify(getJwtSecret(), data, signature);
  if (!ok) throw new Error('Invalid signature');
  const payloadJson = new TextDecoder().decode(base64UrlDecodeToBytes(payloadB64));
  const payload = JSON.parse(payloadJson) as JwtPayload;
  if (payload.exp && payload.exp < nowSeconds()) throw new Error('Token expired');
  return payload;
}

export function getBearerToken(req: Request) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const [scheme, value] = auth.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
  return value || null;
}

export function getCookie(req: Request, name: string) {
  const cookie = req.headers.get('cookie') || '';
  const parts = cookie.split(';').map((part) => part.trim());
  const found = parts.find((part) => part.startsWith(`${name}=`));
  if (!found) return null;
  return found.substring(name.length + 1);
}

export function setRefreshCookie(token: string, maxAgeSeconds: number) {
  const secure = env.NODE_ENV === 'production' ? 'Secure; ' : '';
  return `refresh_token=${token}; ${secure}HttpOnly; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Strict`;
}

export function clearRefreshCookie() {
  const secure = env.NODE_ENV === 'production' ? 'Secure; ' : '';
  return `refresh_token=; ${secure}HttpOnly; Path=/; Max-Age=0; SameSite=Strict`;
}
