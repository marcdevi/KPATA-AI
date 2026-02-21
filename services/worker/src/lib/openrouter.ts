/**
 * OpenRouter AI Client for KPATA AI Worker
 * Handles image generation via OpenRouter API
 */

import { logger } from '../logger.js';

export interface OpenRouterConfig {
  apiKey: string;
  baseUrl: string;
}

export interface ImageGenerationParams {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  model?: string;
  mannequinFaceBase64?: string;
  mannequinBodyBase64?: string;
}

export interface ImageGenerationResult {
  imageBase64: string;
  model: string;
  provider: string;
}

function getConfig(): OpenRouterConfig {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

  if (!apiKey) {
    throw new Error('Missing OPENROUTER_API_KEY');
  }

  return { apiKey, baseUrl };
}

/**
 * Generate background removal/replacement prompt based on category and style
 */
export function generatePrompt(category: string, backgroundStyle: string): { prompt: string; negativePrompt: string } {
  const categoryPrompts: Record<string, string> = {
    clothing: 'Generate a professional product photography of a clothing item on',
    beauty: 'Generate a professional beauty product photography on',
    accessories: 'Generate a professional accessory product photography on',
    shoes: 'Generate a professional footwear product photography on',
    jewelry: 'Generate a professional jewelry product photography on',
    bags: 'Generate a professional bag product photography on',
  };

  const backgroundPrompts: Record<string, string> = {
    studio_white: 'a clean white studio background with professional lighting and soft shadows',
    studio_gray: 'a neutral gray studio background with professional lighting and soft shadows',
    gradient_soft: 'a soft gradient background with professional lighting, elegant style',
    outdoor_street: 'an urban street background, city environment, modern style',
    outdoor_nature: 'a natural outdoor background with nature and greenery',
    lifestyle_cafe: 'a cozy cafe interior background with warm lighting',
    lifestyle_home: 'a modern home interior background, lifestyle setting',
    abstract_colorful: 'an abstract colorful background, vibrant and artistic',
    custom: 'a professional product photography background',
  };

  const categoryPrompt = categoryPrompts[category] || categoryPrompts.clothing;
  const bgPrompt = backgroundPrompts[backgroundStyle] || backgroundPrompts.studio_white;

  return {
    prompt: `${categoryPrompt} ${bgPrompt}. High quality, 4k, detailed, commercial photography style.`,
    negativePrompt: 'blurry, low quality, distorted, watermark, text, logo, amateur, bad lighting',
  };
}

/**
 * Call OpenRouter API for image generation using Gemini
 * Uses modalities: ['image', 'text'] to enable image generation
 */
export async function generateImage(
  inputImageBase64: string,
  params: ImageGenerationParams,
  correlationId: string
): Promise<ImageGenerationResult> {
  const config = getConfig();
  const model = params.model || process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-image';

  logger.info('Starting AI image generation', {
    action: 'openrouter_start',
    correlation_id: correlationId,
    meta: { 
      model, 
      prompt: params.prompt,
      inputImageSize: inputImageBase64.length,
      hasInputImage: !!inputImageBase64,
      hasMannequinFace: !!params.mannequinFaceBase64,
      hasMannequinBody: !!params.mannequinBodyBase64,
    },
  });

  const startTime = Date.now();

  try {
    // Build content array with product image and optional mannequin images
    const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      {
        type: 'text',
        text: params.mannequinFaceBase64 && params.mannequinBodyBase64
          ? `${params.prompt}\n\nUse the provided mannequin face and body images to create a realistic product visualization with the mannequin wearing or displaying the product.`
          : params.prompt,
      },
      {
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${inputImageBase64}`,
        },
      },
    ];

    // Add mannequin images if provided (stored as webp in R2)
    if (params.mannequinFaceBase64) {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/webp;base64,${params.mannequinFaceBase64}`,
        },
      });
    }

    if (params.mannequinBodyBase64) {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/webp;base64,${params.mannequinBodyBase64}`,
        },
      });
    }

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://kpata.ai',
        'X-Title': 'KPATA AI Worker',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content,
          },
        ],
        modalities: ['image', 'text'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    const duration = Date.now() - startTime;

    // Extract image from response - OpenRouter returns images in message.images array
    const message = data.choices?.[0]?.message;

    if (message?.images && message.images.length > 0) {
      const imageUrl = message.images[0].image_url?.url;

      if (imageUrl && imageUrl.startsWith('data:image')) {
        // Extract base64 from data URL (format: data:image/png;base64,XXXXX)
        const base64Data = imageUrl.split(',')[1];

        logger.info('AI image generation completed', {
          action: 'openrouter_success',
          correlation_id: correlationId,
          duration_ms: duration,
          meta: { model, provider: 'openrouter', imageCount: message.images.length },
        });

        return {
          imageBase64: base64Data,
          model,
          provider: 'openrouter',
        };
      }
    }

    // Fallback if no image in response
    logger.warn('No image in OpenRouter response, using placeholder', {
      action: 'openrouter_no_image',
      correlation_id: correlationId,
      meta: { model, hasImages: !!message?.images },
    });

    return {
      imageBase64: await generatePlaceholderImage(params.width || 1080, params.height || 1080, '#10b981'),
      model: 'placeholder',
      provider: 'fallback',
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('AI image generation failed', {
      action: 'openrouter_error',
      correlation_id: correlationId,
      duration_ms: duration,
      meta: { model, error: String(error) },
    });
    throw error;
  }
}

/**
 * Generate a simple placeholder image for testing
 * Returns a PNG image as base64 (compatible with sharp)
 */
export async function generatePlaceholderImage(
  width: number,
  height: number,
  color: string = '#6366f1'
): Promise<string> {
  const { default: sharp } = await import('sharp');
  // Parse hex color to RGB
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);

  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r, g, b },
    },
  })
    .png()
    .toBuffer();

  return buffer.toString('base64');
}
