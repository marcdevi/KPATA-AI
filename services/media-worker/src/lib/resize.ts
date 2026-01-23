/**
 * Image Resize Utilities for KPATA AI Media Worker
 * Uses Cloudflare Image Resizing when available
 */

const ALLOWED_SIZES = [64, 128, 256, 512] as const;
export type AllowedSize = (typeof ALLOWED_SIZES)[number];

export function isAllowedSize(size: number): size is AllowedSize {
  return ALLOWED_SIZES.includes(size as AllowedSize);
}

export function getAllowedSizes(): readonly number[] {
  return ALLOWED_SIZES;
}

/**
 * Parse thumbnail request from path
 * Expected format: /thumb/{size}/gallery/{userId}/{jobId}/...
 */
export function parseThumbnailRequest(
  path: string
): { size: AllowedSize; originalPath: string } | null {
  const match = path.match(/^\/thumb\/(\d+)\/(.+)$/);
  if (!match) return null;

  const size = parseInt(match[1], 10);
  if (!isAllowedSize(size)) return null;

  return {
    size,
    originalPath: match[2],
  };
}

/**
 * Generate cache key for thumbnail
 */
export function getThumbnailCacheKey(originalPath: string, size: AllowedSize): string {
  return `thumb_${size}_${originalPath.replace(/\//g, '_')}`;
}

/**
 * Get cache headers for thumbnails
 * - Browser cache: 1 hour
 * - CDN cache: 1 day
 */
export function getThumbnailCacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    'CDN-Cache-Control': 'public, max-age=86400',
    Vary: 'Accept',
  };
}

/**
 * Get cache headers for original images
 * - Browser cache: 5 minutes
 * - CDN cache: 1 hour
 */
export function getImageCacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'public, max-age=300, s-maxage=3600',
    'CDN-Cache-Control': 'public, max-age=3600',
    Vary: 'Accept',
  };
}
