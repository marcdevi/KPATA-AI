/**
 * Watermark for KPATA AI Worker
 * user_free: watermark "KPATA AI" 40% opacity
 * user_pro: no watermark
 */

import sharp from 'sharp';

export interface WatermarkOptions {
  isPro: boolean;
  text?: string;
  opacity?: number;
  position?: 'bottom-right' | 'bottom-left' | 'center';
}

const DEFAULT_OPTIONS: Required<Omit<WatermarkOptions, 'isPro'>> = {
  text: 'KPATA AI',
  opacity: 0.4,
  position: 'bottom-right',
};

/**
 * Apply watermark to image based on user plan
 */
export async function applyWatermark(
  imageBuffer: Buffer,
  options: WatermarkOptions
): Promise<Buffer> {
  // Pro users: no watermark
  if (options.isPro) {
    return imageBuffer;
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 1080;
  const height = metadata.height || 1080;

  // Create watermark SVG
  const watermarkSvg = createWatermarkSvg(opts.text, width, height, opts.opacity);

  // Calculate position
  const position = getWatermarkPosition(opts.position, width, height);

  // Composite watermark onto image
  return sharp(imageBuffer)
    .composite([
      {
        input: Buffer.from(watermarkSvg),
        left: position.left,
        top: position.top,
      },
    ])
    .toBuffer();
}

/**
 * Create watermark SVG with specified opacity
 */
function createWatermarkSvg(
  text: string,
  imageWidth: number,
  _imageHeight: number,
  opacity: number
): string {
  const fontSize = Math.floor(imageWidth * 0.04); // 4% of image width
  const padding = Math.floor(imageWidth * 0.03);
  const textWidth = text.length * fontSize * 0.6;
  const textHeight = fontSize * 1.2;

  const svgWidth = textWidth + padding * 2;
  const svgHeight = textHeight + padding;

  return `
    <svg width="${svgWidth}" height="${svgHeight}">
      <style>
        .watermark {
          font-family: Arial, Helvetica, sans-serif;
          font-size: ${fontSize}px;
          font-weight: bold;
          fill: rgba(255, 255, 255, ${opacity});
          text-shadow: 1px 1px 2px rgba(0, 0, 0, ${opacity * 0.5});
        }
      </style>
      <text x="${padding}" y="${textHeight}" class="watermark">${escapeXml(text)}</text>
    </svg>
  `;
}

/**
 * Get watermark position coordinates
 */
function getWatermarkPosition(
  position: 'bottom-right' | 'bottom-left' | 'center',
  imageWidth: number,
  imageHeight: number
): { left: number; top: number } {
  const padding = Math.floor(imageWidth * 0.03);
  const watermarkWidth = Math.floor(imageWidth * 0.25);
  const watermarkHeight = Math.floor(imageWidth * 0.06);

  switch (position) {
    case 'bottom-left':
      return {
        left: padding,
        top: imageHeight - watermarkHeight - padding,
      };
    case 'center':
      return {
        left: Math.floor((imageWidth - watermarkWidth) / 2),
        top: Math.floor((imageHeight - watermarkHeight) / 2),
      };
    case 'bottom-right':
    default:
      return {
        left: imageWidth - watermarkWidth - padding,
        top: imageHeight - watermarkHeight - padding,
      };
  }
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
