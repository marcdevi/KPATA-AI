/**
 * Media Routes for KPATA AI API
 * Handles media token generation for secure access to media.kpata.ai
 */

import { generateMediaToken, TOKEN_EXPIRY_SECONDS } from '../lib/mediaToken.js';
import { logger } from '../logger.js';

export interface MediaTokenRequest {
  path: string;
  userId: string;
  correlationId?: string;
}

export interface MediaTokenResponse {
  token: string;
  expiresIn: number;
  url: string;
}

/**
 * Get the media token secret from environment
 */
function getMediaTokenSecret(): string {
  const secret = process.env.MEDIA_TOKEN_SECRET;
  if (!secret) {
    throw new Error('MEDIA_TOKEN_SECRET environment variable is required');
  }
  return secret;
}

/**
 * Get the media worker base URL
 */
function getMediaWorkerUrl(): string {
  return process.env.MEDIA_WORKER_URL || 'https://media.kpata.ai';
}

/**
 * Generate a media access token
 * 
 * GET /media/token?path=gallery/{userId}/{jobId}/v1/original.webp
 * 
 * Returns:
 * {
 *   token: "...",
 *   expiresIn: 600,
 *   url: "https://media.kpata.ai/gallery/.../original.webp?token=..."
 * }
 */
export async function handleMediaTokenRequest(
  request: MediaTokenRequest
): Promise<MediaTokenResponse> {
  const { path, userId, correlationId } = request;
  const startTime = Date.now();

  // Validate path format
  if (!path || !path.startsWith('gallery/')) {
    throw new Error('Invalid path: must start with gallery/');
  }

  // Validate that path contains the userId
  const pathUserId = path.split('/')[1];
  if (pathUserId !== userId) {
    logger.warn('Media token request path mismatch', {
      action: 'media_token_path_mismatch',
      correlation_id: correlationId,
      user_id: userId,
      meta: { path, pathUserId },
    });
    throw new Error('Unauthorized: path does not match user');
  }

  const secret = getMediaTokenSecret();
  const token = await generateMediaToken(path, userId, secret, TOKEN_EXPIRY_SECONDS);
  const baseUrl = getMediaWorkerUrl();
  const url = `${baseUrl}/${path}?token=${encodeURIComponent(token)}`;

  logger.info('Media token generated', {
    action: 'media_token_generated',
    correlation_id: correlationId,
    user_id: userId,
    duration_ms: Date.now() - startTime,
    meta: { path, expiresIn: TOKEN_EXPIRY_SECONDS },
  });

  return {
    token,
    expiresIn: TOKEN_EXPIRY_SECONDS,
    url,
  };
}

/**
 * Generate a thumbnail URL with token
 */
export async function handleThumbnailTokenRequest(
  request: MediaTokenRequest & { size: 64 | 128 | 256 | 512 }
): Promise<MediaTokenResponse> {
  const { path, userId, size, correlationId } = request;
  const startTime = Date.now();

  // Validate path format
  if (!path || !path.startsWith('gallery/')) {
    throw new Error('Invalid path: must start with gallery/');
  }

  // Validate that path contains the userId
  const pathUserId = path.split('/')[1];
  if (pathUserId !== userId) {
    throw new Error('Unauthorized: path does not match user');
  }

  // Validate size
  const allowedSizes = [64, 128, 256, 512];
  if (!allowedSizes.includes(size)) {
    throw new Error(`Invalid size: must be one of ${allowedSizes.join(', ')}`);
  }

  const secret = getMediaTokenSecret();
  const token = await generateMediaToken(path, userId, secret, TOKEN_EXPIRY_SECONDS);
  const baseUrl = getMediaWorkerUrl();
  const url = `${baseUrl}/thumb/${size}/${path}?token=${encodeURIComponent(token)}`;

  logger.info('Thumbnail token generated', {
    action: 'thumbnail_token_generated',
    correlation_id: correlationId,
    user_id: userId,
    duration_ms: Date.now() - startTime,
    meta: { path, size, expiresIn: TOKEN_EXPIRY_SECONDS },
  });

  return {
    token,
    expiresIn: TOKEN_EXPIRY_SECONDS,
    url,
  };
}
