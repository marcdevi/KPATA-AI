/**
 * R2 Storage Constants and Key Generators
 * Bucket naming and key structure conventions for KPATA AI
 */

export const R2_BUCKETS = {
  RAW_UPLOAD: 'kpata-raw-upload',
  PUBLIC_GALLERY: 'kpata-public-gallery',
} as const;

export const R2_LIFECYCLE = {
  RAW_DELETE_DAYS: 7,
  GALLERY_DELETE_DAYS: 365,
} as const;

export const THUMBNAIL_SIZES = [64, 128, 256, 512] as const;
export type ThumbnailSize = (typeof THUMBNAIL_SIZES)[number];

export interface R2KeyParams {
  userId: string;
  jobId: string;
  year?: number;
  month?: number;
}

export interface GalleryKeyParams extends R2KeyParams {
  pipelineVersion: number;
  variant: 'original' | 'optimized' | 'thumbnail';
}

/**
 * Generate raw upload key
 * Format: uploads/{YYYY}/{MM}/{userId}/{jobId}.jpg
 */
export function generateRawUploadKey(params: R2KeyParams): string {
  const now = new Date();
  const year = params.year ?? now.getFullYear();
  const month = params.month ?? now.getMonth() + 1;
  const monthStr = month.toString().padStart(2, '0');

  return `uploads/${year}/${monthStr}/${params.userId}/${params.jobId}.jpg`;
}

/**
 * Generate gallery key
 * Format: gallery/{userId}/{jobId}/v{pipelineVersion}/{variant}.webp
 */
export function generateGalleryKey(params: GalleryKeyParams): string {
  return `gallery/${params.userId}/${params.jobId}/v${params.pipelineVersion}/${params.variant}.webp`;
}

/**
 * Generate thumbnail key
 * Format: gallery/{userId}/{jobId}/v{pipelineVersion}/thumb_{size}.webp
 */
export function generateThumbnailKey(
  params: Omit<GalleryKeyParams, 'variant'>,
  size: ThumbnailSize
): string {
  return `gallery/${params.userId}/${params.jobId}/v${params.pipelineVersion}/thumb_${size}.webp`;
}

/**
 * Parse a gallery path to extract userId
 * Used for pathPrefix validation in media worker
 */
export function parseGalleryPath(path: string): { userId: string; jobId: string } | null {
  const match = path.match(/^gallery\/([^/]+)\/([^/]+)\//);
  if (!match) return null;
  return { userId: match[1], jobId: match[2] };
}

/**
 * Validate thumbnail size
 */
export function isValidThumbnailSize(size: number): size is ThumbnailSize {
  return THUMBNAIL_SIZES.includes(size as ThumbnailSize);
}
