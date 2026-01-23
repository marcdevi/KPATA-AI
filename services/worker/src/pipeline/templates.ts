/**
 * Template Layouts for KPATA AI Worker
 * A/B/C layouts with price, @handle, badge positions
 * Exports: WhatsApp Status 9:16 + Instagram 1:1
 */

import sharp from 'sharp';

// Export dimensions
export const EXPORT_DIMENSIONS = {
  WHATSAPP_STATUS: { width: 1080, height: 1920 }, // 9:16
  INSTAGRAM_SQUARE: { width: 1080, height: 1080 }, // 1:1
} as const;

export type TemplateType = 'A' | 'B' | 'C';

export interface TemplateOptions {
  template: TemplateType;
  price?: number;
  currency?: string;
  handle?: string;
  badge?: string;
  productImage: Buffer;
  backgroundImage: Buffer;
}

export interface TemplateResult {
  whatsappStatus: Buffer;
  instagramSquare: Buffer;
}

/**
 * Format price in West African style: 12 000 FCFA
 */
export function formatPrice(amount: number, currency = 'FCFA'): string {
  const formatted = amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} ${currency}`;
}

/**
 * Apply template layout to product image
 */
export async function applyTemplate(options: TemplateOptions): Promise<TemplateResult> {
  const { template } = options;

  // Generate both export formats
  const [whatsappStatus, instagramSquare] = await Promise.all([
    generateExport(options, EXPORT_DIMENSIONS.WHATSAPP_STATUS, template),
    generateExport(options, EXPORT_DIMENSIONS.INSTAGRAM_SQUARE, template),
  ]);

  return { whatsappStatus, instagramSquare };
}

/**
 * Generate export with specific dimensions
 */
async function generateExport(
  options: TemplateOptions,
  dimensions: { width: number; height: number },
  template: TemplateType
): Promise<Buffer> {
  const { width, height } = dimensions;
  const { productImage, backgroundImage, price, currency, handle, badge } = options;

  // Resize background to target dimensions
  const background = await sharp(backgroundImage)
    .resize(width, height, { fit: 'cover' })
    .png()
    .toBuffer();

  // Calculate product placement based on template
  const placement = getTemplatePlacement(template, width, height);

  // Resize product image to fit in designated area
  const productResized = await sharp(productImage)
    .resize(placement.product.width, placement.product.height, { fit: 'inside' })
    .png()
    .toBuffer();

  // Get product dimensions after resize
  const productMeta = await sharp(productResized).metadata();
  const productWidth = productMeta.width || placement.product.width;
  const productHeight = productMeta.height || placement.product.height;

  // Center product in its designated area
  const productLeft = placement.product.x + Math.floor((placement.product.width - productWidth) / 2);
  const productTop = placement.product.y + Math.floor((placement.product.height - productHeight) / 2);

  // Build composite layers
  const composites: sharp.OverlayOptions[] = [
    {
      input: productResized,
      left: productLeft,
      top: productTop,
    },
  ];

  // Add text overlays (price, handle, badge)
  if (price) {
    const priceText = formatPrice(price, currency);
    const priceSvg = createTextSvg(priceText, placement.price, 'price');
    composites.push({
      input: Buffer.from(priceSvg),
      left: placement.price.x,
      top: placement.price.y,
    });
  }

  if (handle) {
    const handleSvg = createTextSvg(`@${handle}`, placement.handle, 'handle');
    composites.push({
      input: Buffer.from(handleSvg),
      left: placement.handle.x,
      top: placement.handle.y,
    });
  }

  if (badge) {
    const badgeSvg = createTextSvg(badge, placement.badge, 'badge');
    composites.push({
      input: Buffer.from(badgeSvg),
      left: placement.badge.x,
      top: placement.badge.y,
    });
  }

  // Composite all layers
  return sharp(background)
    .composite(composites)
    .png()
    .toBuffer();
}

interface Placement {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TemplatePlacements {
  product: Placement;
  price: Placement;
  handle: Placement;
  badge: Placement;
}

/**
 * Get element placements for each template type
 */
function getTemplatePlacement(template: TemplateType, width: number, height: number): TemplatePlacements {
  const isPortrait = height > width;
  const padding = Math.floor(width * 0.05);

  switch (template) {
    case 'A':
      // Template A: Product centered, price bottom-left, handle bottom-right, badge top-right
      return {
        product: {
          x: padding,
          y: isPortrait ? Math.floor(height * 0.15) : padding,
          width: width - padding * 2,
          height: isPortrait ? Math.floor(height * 0.6) : height - padding * 2 - 100,
        },
        price: {
          x: padding,
          y: height - padding - 60,
          width: Math.floor(width * 0.4),
          height: 50,
        },
        handle: {
          x: width - padding - Math.floor(width * 0.35),
          y: height - padding - 40,
          width: Math.floor(width * 0.35),
          height: 30,
        },
        badge: {
          x: width - padding - 120,
          y: padding,
          width: 120,
          height: 40,
        },
      };

    case 'B':
      // Template B: Product top, price center-bottom, handle bottom-center, badge top-left
      return {
        product: {
          x: padding,
          y: padding,
          width: width - padding * 2,
          height: isPortrait ? Math.floor(height * 0.65) : Math.floor(height * 0.7),
        },
        price: {
          x: Math.floor(width * 0.3),
          y: height - padding - 100,
          width: Math.floor(width * 0.4),
          height: 50,
        },
        handle: {
          x: Math.floor(width * 0.3),
          y: height - padding - 40,
          width: Math.floor(width * 0.4),
          height: 30,
        },
        badge: {
          x: padding,
          y: padding,
          width: 120,
          height: 40,
        },
      };

    case 'C':
    default:
      // Template C: Product right-aligned, price left, handle left-bottom, badge top-center
      return {
        product: {
          x: Math.floor(width * 0.1),
          y: isPortrait ? Math.floor(height * 0.2) : padding,
          width: Math.floor(width * 0.8),
          height: isPortrait ? Math.floor(height * 0.55) : height - padding * 2 - 120,
        },
        price: {
          x: padding,
          y: isPortrait ? height - padding - 150 : height - padding - 80,
          width: Math.floor(width * 0.5),
          height: 50,
        },
        handle: {
          x: padding,
          y: height - padding - 40,
          width: Math.floor(width * 0.4),
          height: 30,
        },
        badge: {
          x: Math.floor(width * 0.4),
          y: padding,
          width: Math.floor(width * 0.2),
          height: 40,
        },
      };
  }
}

/**
 * Create SVG text element
 */
function createTextSvg(
  text: string,
  placement: Placement,
  type: 'price' | 'handle' | 'badge'
): string {
  const { width, height } = placement;
  
  const styles: Record<string, { fontSize: number; fontWeight: string; color: string }> = {
    price: { fontSize: 36, fontWeight: 'bold', color: '#FFFFFF' },
    handle: { fontSize: 20, fontWeight: 'normal', color: '#FFFFFF' },
    badge: { fontSize: 16, fontWeight: 'bold', color: '#FFD700' },
  };

  const style = styles[type];

  return `
    <svg width="${width}" height="${height}">
      <style>
        .text { 
          font-family: Arial, sans-serif; 
          font-size: ${style.fontSize}px; 
          font-weight: ${style.fontWeight}; 
          fill: ${style.color};
          text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
        }
      </style>
      <text x="0" y="${height * 0.7}" class="text">${escapeXml(text)}</text>
    </svg>
  `;
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
