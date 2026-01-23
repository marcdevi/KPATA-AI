/**
 * Media Token Utilities for KPATA AI Media Worker
 * HMAC-based token generation and validation
 */

const ALGORITHM = 'SHA-256';
const TOKEN_EXPIRY_SECONDS = 600; // 10 minutes

export interface MediaTokenPayload {
  path: string;
  userId: string;
  exp: number;
  iat: number;
}

export interface TokenValidationResult {
  valid: boolean;
  payload?: MediaTokenPayload;
  error?: string;
}

/**
 * Encode payload to base64url
 */
function base64UrlEncode(data: string): string {
  const base64 = btoa(data);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode base64url to string
 */
function base64UrlDecode(data: string): string {
  let base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

/**
 * Generate HMAC signature
 */
async function generateSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: ALGORITHM },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  const signatureArray = new Uint8Array(signature);
  const signatureBase64 = btoa(String.fromCharCode(...signatureArray));
  return signatureBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Verify HMAC signature
 */
async function verifySignature(data: string, signature: string, secret: string): Promise<boolean> {
  const expectedSignature = await generateSignature(data, secret);
  return signature === expectedSignature;
}

/**
 * Generate a media access token
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
 * Validate a media access token
 */
export async function validateMediaToken(
  token: string,
  secret: string
): Promise<TokenValidationResult> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'Invalid token format' };
    }

    const [encodedPayload, signature] = parts;

    // Verify signature
    const isValid = await verifySignature(encodedPayload, signature, secret);
    if (!isValid) {
      return { valid: false, error: 'Invalid signature' };
    }

    // Decode payload
    const payloadStr = base64UrlDecode(encodedPayload);
    const payload: MediaTokenPayload = JSON.parse(payloadStr);

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: `Token validation failed: ${String(error)}` };
  }
}

/**
 * Validate that the requested path matches the token's authorized path prefix
 */
export function validatePathPrefix(requestedPath: string, tokenPayload: MediaTokenPayload): boolean {
  // Extract userId from the requested path
  // Expected format: gallery/{userId}/...
  const pathMatch = requestedPath.match(/^gallery\/([^/]+)\//);
  if (!pathMatch) {
    return false;
  }

  const pathUserId = pathMatch[1];
  return pathUserId === tokenPayload.userId;
}

export { TOKEN_EXPIRY_SECONDS };
