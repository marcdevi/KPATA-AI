/**
 * NSFW Detection for KPATA AI
 * Pre-check images before job creation using nsfwjs
 */

import * as nsfwjs from '@nsfw-filter/nsfwjs';
import * as tf from '@tensorflow/tfjs';
import { Jimp } from 'jimp';

let model: nsfwjs.NSFWJS | null = null;
let modelLoading: Promise<nsfwjs.NSFWJS> | null = null;

// NSFW thresholds
const NSFW_THRESHOLD = 0.8;
const NSFW_CATEGORIES = ['Porn', 'Hentai'] as const;

export interface NSFWPrediction {
  className: string;
  probability: number;
}

export interface NSFWCheckResult {
  isNSFW: boolean;
  predictions: NSFWPrediction[];
  violatingCategory?: string;
  violatingScore?: number;
}

/**
 * Load NSFW model (singleton with lazy loading)
 */
async function loadModel(): Promise<nsfwjs.NSFWJS> {
  if (model) {
    return model;
  }

  if (modelLoading) {
    return modelLoading;
  }

  modelLoading = nsfwjs.load();
  model = await modelLoading;
  modelLoading = null;

  return model;
}

/**
 * Check if an image buffer contains NSFW content
 * @param imageBuffer - Image buffer (JPEG, PNG, etc.)
 * @returns NSFWCheckResult with detection details
 */
export async function checkNSFW(imageBuffer: Buffer): Promise<NSFWCheckResult> {
  const nsfwModel = await loadModel();

  // Decode image to tensor using Jimp (pure JS, no native deps)
  let imageTensor: tf.Tensor3D;
  try {
    const image = await Jimp.read(imageBuffer);
    const { width, height } = image.bitmap;
    const pixels = new Uint8Array(width * height * 3);
    
    let idx = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const color = image.getPixelColor(x, y);
        pixels[idx++] = (color >> 24) & 0xff; // R
        pixels[idx++] = (color >> 16) & 0xff; // G
        pixels[idx++] = (color >> 8) & 0xff;  // B
      }
    }
    
    imageTensor = tf.tensor3d(pixels, [height, width, 3], 'int32') as tf.Tensor3D;
  } catch (_error) {
    throw new Error('Failed to decode image for NSFW check');
  }

  try {
    // Run predictions
    const predictions = await nsfwModel.classify(imageTensor);

    // Check for NSFW content
    for (const pred of predictions) {
      if (
        NSFW_CATEGORIES.includes(pred.className as typeof NSFW_CATEGORIES[number]) &&
        pred.probability > NSFW_THRESHOLD
      ) {
        return {
          isNSFW: true,
          predictions,
          violatingCategory: pred.className,
          violatingScore: pred.probability,
        };
      }
    }

    return {
      isNSFW: false,
      predictions,
    };
  } finally {
    // Clean up tensor
    imageTensor.dispose();
  }
}

/**
 * Check NSFW from base64 encoded image
 */
export async function checkNSFWBase64(base64Image: string): Promise<NSFWCheckResult> {
  // Remove data URL prefix if present
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Buffer.from(base64Data, 'base64');
  return checkNSFW(imageBuffer);
}

/**
 * Get human-readable NSFW warning message
 */
export function getNSFWWarningMessage(result: NSFWCheckResult, language = 'fr'): string {
  if (language === 'fr') {
    return `⚠️ Contenu inapproprié détecté. Votre image a été rejetée car elle contient du contenu interdit (${result.violatingCategory}). Cette violation a été enregistrée.`;
  }
  return `⚠️ Inappropriate content detected. Your image was rejected because it contains prohibited content (${result.violatingCategory}). This violation has been recorded.`;
}

/**
 * Preload the model (call on server startup)
 */
export async function preloadNSFWModel(): Promise<void> {
  await loadModel();
}
