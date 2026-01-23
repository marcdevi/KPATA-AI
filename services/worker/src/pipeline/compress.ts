/**
 * Image Compression for KPATA AI Worker
 * WebP/JPG quality 85, target <300KB
 */

import sharp from 'sharp';

const TARGET_SIZE_KB = 300;
const MAX_QUALITY = 85;
const MIN_QUALITY = 65;

export interface CompressionResult {
  buffer: Buffer;
  format: 'webp' | 'jpeg';
  quality: number;
  sizeKb: number;
  wasCompressed: boolean;
}

export interface CompressionOptions {
  targetSizeKb?: number;
  maxQuality?: number;
  minQuality?: number;
  preferWebP?: boolean;
}

/**
 * Compress image to target size
 * Tries WebP first, falls back to JPEG if needed
 */
export async function compressImage(
  imageBuffer: Buffer,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const {
    targetSizeKb = TARGET_SIZE_KB,
    maxQuality = MAX_QUALITY,
    minQuality = MIN_QUALITY,
    preferWebP = true,
  } = options;

  const targetSizeBytes = targetSizeKb * 1024;

  // Try WebP first (usually smaller)
  if (preferWebP) {
    const webpResult = await compressWithFormat(
      imageBuffer,
      'webp',
      targetSizeBytes,
      maxQuality,
      minQuality
    );

    if (webpResult.buffer.length <= targetSizeBytes) {
      return webpResult;
    }
  }

  // Try JPEG
  const jpegResult = await compressWithFormat(
    imageBuffer,
    'jpeg',
    targetSizeBytes,
    maxQuality,
    minQuality
  );

  // Return the smaller one
  if (preferWebP) {
    const webpResult = await compressWithFormat(
      imageBuffer,
      'webp',
      targetSizeBytes,
      maxQuality,
      minQuality
    );

    if (webpResult.buffer.length < jpegResult.buffer.length) {
      return webpResult;
    }
  }

  return jpegResult;
}

/**
 * Compress with specific format, reducing quality until target size is met
 */
async function compressWithFormat(
  imageBuffer: Buffer,
  format: 'webp' | 'jpeg',
  targetSizeBytes: number,
  maxQuality: number,
  minQuality: number
): Promise<CompressionResult> {
  let quality = maxQuality;
  let result: Buffer;
  let wasCompressed = false;

  // Binary search for optimal quality
  while (quality >= minQuality) {
    if (format === 'webp') {
      result = await sharp(imageBuffer)
        .webp({ quality })
        .toBuffer();
    } else {
      result = await sharp(imageBuffer)
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
    }

    if (result.length <= targetSizeBytes) {
      return {
        buffer: result,
        format,
        quality,
        sizeKb: Math.round(result.length / 1024),
        wasCompressed: quality < maxQuality,
      };
    }

    wasCompressed = true;
    quality -= 5; // Reduce quality by 5 each iteration
  }

  // Return at minimum quality even if over target
  if (format === 'webp') {
    result = await sharp(imageBuffer)
      .webp({ quality: minQuality })
      .toBuffer();
  } else {
    result = await sharp(imageBuffer)
      .jpeg({ quality: minQuality, mozjpeg: true })
      .toBuffer();
  }

  return {
    buffer: result,
    format,
    quality: minQuality,
    sizeKb: Math.round(result.length / 1024),
    wasCompressed,
  };
}

/**
 * Check if compression result meets target
 */
export function meetsTargetSize(result: CompressionResult, targetKb = TARGET_SIZE_KB): boolean {
  return result.sizeKb <= targetKb;
}
