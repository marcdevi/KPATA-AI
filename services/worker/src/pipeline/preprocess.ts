/**
 * Image Preprocessing for KPATA AI Worker
 * EXIF autorotate, downscale, denoise
 */

import sharp from 'sharp';

// Target dimensions
const MAX_DIMENSION = 1024;
const PORTRAIT_WIDTH = 768;
const PORTRAIT_HEIGHT = 1024;

export interface PreprocessResult {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  isPortrait: boolean;
  originalWidth: number;
  originalHeight: number;
}

export interface PreprocessOptions {
  maxDimension?: number;
  denoise?: boolean;
  quality?: number;
}

/**
 * Preprocess image: EXIF autorotate, smart downscale, optional denoise
 */
export async function preprocessImage(
  inputBuffer: Buffer,
  options: PreprocessOptions = {}
): Promise<PreprocessResult> {
  const { maxDimension = MAX_DIMENSION, denoise = true } = options;

  // Get original metadata
  const metadata = await sharp(inputBuffer).metadata();
  const originalWidth = metadata.width || 0;
  const originalHeight = metadata.height || 0;

  // Determine if portrait
  const isPortrait = originalHeight > originalWidth;

  // Calculate target dimensions
  let targetWidth: number;
  let targetHeight: number;

  if (isPortrait) {
    // Portrait: 768x1024
    targetWidth = PORTRAIT_WIDTH;
    targetHeight = PORTRAIT_HEIGHT;
  } else {
    // Square or landscape: max 1024x1024
    if (originalWidth > originalHeight) {
      targetWidth = maxDimension;
      targetHeight = Math.round((originalHeight / originalWidth) * maxDimension);
    } else {
      targetWidth = Math.round((originalWidth / originalHeight) * maxDimension);
      targetHeight = maxDimension;
    }
  }

  // Only downscale, never upscale
  if (originalWidth <= targetWidth && originalHeight <= targetHeight) {
    targetWidth = originalWidth;
    targetHeight = originalHeight;
  }

  // Build sharp pipeline
  let pipeline = sharp(inputBuffer)
    .rotate() // EXIF autorotate
    .resize(targetWidth, targetHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    });

  // Apply light denoise if enabled (using sharp's median filter as NLM alternative)
  if (denoise) {
    pipeline = pipeline.median(3); // Light denoise
  }

  // Convert to PNG for lossless processing in pipeline
  const outputBuffer = await pipeline.png().toBuffer();

  // Get final dimensions
  const outputMetadata = await sharp(outputBuffer).metadata();

  return {
    buffer: outputBuffer,
    width: outputMetadata.width || targetWidth,
    height: outputMetadata.height || targetHeight,
    format: 'png',
    isPortrait,
    originalWidth,
    originalHeight,
  };
}

/**
 * Quick resize without preprocessing (for thumbnails)
 */
export async function quickResize(
  inputBuffer: Buffer,
  width: number,
  height: number
): Promise<Buffer> {
  return sharp(inputBuffer)
    .resize(width, height, { fit: 'cover' })
    .png()
    .toBuffer();
}
