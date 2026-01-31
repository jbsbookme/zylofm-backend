import { env } from './_env';

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha1Hex(value: string) {
  const data = encoder.encode(value);
  const hash = await crypto.subtle.digest('SHA-1', data);
  return toHex(hash);
}

export function getCloudinaryConfig() {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary config missing');
  }

  return { cloudName, apiKey, apiSecret };
}

export async function signCloudinaryParams(params: Record<string, string | number>) {
  const { apiSecret } = getCloudinaryConfig();
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  const signature = await sha1Hex(`${sorted}${apiSecret}`);
  return signature;
}

export async function verifyCloudinarySignature(
  params: Record<string, string | number>,
  signature: string,
) {
  const expected = await signCloudinaryParams(params);
  return expected === signature;
}
