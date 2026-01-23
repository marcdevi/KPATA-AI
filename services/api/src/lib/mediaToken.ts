/**
 * Media Token Generation for KPATA AI API
 * Generates HMAC-based tokens for secure media access
 */

const TOKEN_EXPIRY_SECONDS = 600; // 10 minutes

export interface MediaTokenPayload {
  path: string;
  userId: string;
  exp: number;
  iat: number;
}

/**
 * Encode payload to base64url
 */
function base64UrlEncode(data: string): string {
  const base64 = Buffer.from(data).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Generate HMAC signature using Node.js crypto
 */
async function generateSignature(data: string, secret: string): Promise<string> {
  const { createHmac } = await import('crypto');
  const hmac = createHmac('sha256', secret);
  hmac.update(data);
  const signature = hmac.digest('base64');
  return signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Generate a media access token for secure media access
 * Token format: base64url(payload).base64url(signature)
 */
export async function generateMediaToken(
  path: string,
  userId: string,
  secret: string,
  expirySeconds: number = TOKEN_EXPIRY_SECONDS
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: MediaTokenPayload = {
    path,
    userId,
    iat: now,
    exp: now + expirySeconds,
  };

  const payloadStr = JSON.stringify(payload);
  const encodedPayload = base64UrlEncode(payloadStr);
  const signature = await generateSignature(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

/**
 * Get the media worker base URL
 */
export function getMediaWorkerUrl(): string {
  return process.env.MEDIA_WORKER_URL || 'https://media.kpata.ai';
}

/**
 * Generate a full media URL with token
 */
export async function generateSecureMediaUrl(
  path: string,
  userId: string,
  secret: string,
  expirySeconds: number = TOKEN_EXPIRY_SECONDS
): Promise<string> {
  const token = await generateMediaToken(path, userId, secret, expirySeconds);
  const baseUrl = getMediaWorkerUrl();
  return `${baseUrl}/${path}?token=${encodeURIComponent(token)}`;
}

/**
 * Generate a thumbnail URL with token
 */
export async function generateSecureThumbnailUrl(
  path: string,
  userId: string,
  size: 64 | 128 | 256 | 512,
  secret: string,
  expirySeconds: number = TOKEN_EXPIRY_SECONDS
): Promise<string> {
  const token = await generateMediaToken(path, userId, secret, expirySeconds);
  const baseUrl = getMediaWorkerUrl();
  return `${baseUrl}/thumb/${size}/${path}?token=${encodeURIComponent(token)}`;
}

export { TOKEN_EXPIRY_SECONDS };
