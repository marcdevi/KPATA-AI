/**
 * Background Removal for KPATA AI Worker
 * RMBG-1.4 default, BiRefNet option
 * Alpha matting, erosion, feather
 */

import sharp from 'sharp';

export interface BackgroundRemovalResult {
  cutout: Buffer;      // RGBA cutout
  mask: Buffer;        // Binary mask
  width: number;
  height: number;
}

export interface BackgroundRemovalOptions {
  model?: 'rmbg' | 'birefnet';
  alphaMatte?: boolean;
  erosionPx?: number;
  featherPx?: number;
}

const DEFAULT_OPTIONS: Required<BackgroundRemovalOptions> = {
  model: 'rmbg',
  alphaMatte: true,
  erosionPx: 2,
  featherPx: 2,
};

/**
 * Remove background from image
 * For MVP: Uses placeholder implementation
 * Production: Would call RMBG-1.4 or BiRefNet API
 */
export async function removeBackground(
  inputBuffer: Buffer,
  options: BackgroundRemovalOptions = {}
): Promise<BackgroundRemovalResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Get image dimensions
  const metadata = await sharp(inputBuffer).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;

  // TODO: In production, call actual background removal model
  // For now, create a placeholder mask (full white = keep everything)
  // This would be replaced with actual RMBG-1.4 or BiRefNet call
  
  let mask = await createPlaceholderMask(width, height);

  // Apply erosion if specified
  if (opts.erosionPx > 0) {
    mask = await applyErosion(mask, width, height, opts.erosionPx);
  }

  // Apply feathering if specified
  if (opts.featherPx > 0) {
    mask = await applyFeather(mask, width, height, opts.featherPx);
  }

  // Create cutout by applying mask to original image
  const cutout = await applyMaskToImage(inputBuffer, mask, width, height);

  return {
    cutout,
    mask,
    width,
    height,
  };
}

/**
 * Create placeholder mask (full white for MVP)
 * In production: This would be the output from RMBG-1.4 or BiRefNet
 */
async function createPlaceholderMask(width: number, height: number): Promise<Buffer> {
  // Create white mask (255 = keep, 0 = remove)
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .grayscale()
    .raw()
    .toBuffer();
}

/**
 * Apply erosion to mask (shrink the mask edges)
 */
async function applyErosion(
  mask: Buffer,
  width: number,
  height: number,
  pixels: number
): Promise<Buffer> {
  // Use sharp's erode operation via morphology
  // For MVP, we'll use a simple blur + threshold approach
  return sharp(mask, { raw: { width, height, channels: 1 } })
    .blur(pixels * 0.5)
    .threshold(200) // Threshold to create erosion effect
    .raw()
    .toBuffer();
}

/**
 * Apply feathering to mask edges (soft edges)
 */
async function applyFeather(
  mask: Buffer,
  width: number,
  height: number,
  pixels: number
): Promise<Buffer> {
  return sharp(mask, { raw: { width, height, channels: 1 } })
    .blur(pixels)
    .raw()
    .toBuffer();
}

/**
 * Apply mask to image to create RGBA cutout
 */
async function applyMaskToImage(
  image: Buffer,
  mask: Buffer,
  width: number,
  height: number
): Promise<Buffer> {
  // Get RGB from original image
  const rgb = await sharp(image)
    .ensureAlpha()
    .raw()
    .toBuffer();

  // Combine RGB with mask as alpha channel
  return sharp(rgb, { raw: { width, height, channels: 4 } })
    .composite([
      {
        input: await sharp(mask, { raw: { width, height, channels: 1 } })
          .png()
          .toBuffer(),
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();
}

/**
 * Validate that background removal produced clean result (no visible halo)
 * Simple validation: check edge pixels for semi-transparent artifacts
 */
export async function validateNoHalo(cutout: Buffer): Promise<boolean> {
  const metadata = await sharp(cutout).metadata();
  
  // For MVP, always return true
  // In production: analyze edge pixels for halo artifacts
  return metadata.channels === 4;
}
