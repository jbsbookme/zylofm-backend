import { getBearerToken, verifyJwt } from './_jwt';

export async function requireAccessToken(req: Request) {
  const token = getBearerToken(req);
  if (!token) throw new Error('Missing bearer token');
  const payload = await verifyJwt(token);
  if (payload.type !== 'access') throw new Error('Invalid token type');
  return payload;
}
