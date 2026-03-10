/**
 * Mannequin Studio Processor
 * Generates studio-quality face + body photos from a single photo via AI
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { generateImage } from './lib/openrouter.js';
import { downloadObject } from './lib/r2Client.js';
import { logger } from './logger.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}

async function uploadToR2(key: string, buffer: Buffer, contentType: string): Promise<{ bucket: string; key: string; url: string }> {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const publicUrl = process.env.R2_PUBLIC_URL || '';
  const bucket = 'kpata-public-gallery';

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2 configuration');
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  return { bucket, key, url: `${publicUrl}/${key}` };
}

/**
 * Get the mannequin model from model_routing table (category = 'mannequin')
 */
async function getMannequinModel(): Promise<string> {
  const supabase = getSupabase();
  try {
    const { data } = await supabase
      .from('model_routing')
      .select('model')
      .eq('category', 'mannequin')
      .eq('active', true)
      .single();

    if (data?.model) {
      return data.model;
    }
  } catch {
    // Fall through to default
  }

  return process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-exp:free';
}

export interface MannequinJobPayload {
  profileId: string;
  correlationId: string;
  mannequinId: string;
  originalImageBucket: string;
  originalImageKey: string;
}

const FACE_PROMPT = `You are a professional studio photographer. 
Given the provided full-body photo of a person, generate a NEW high-quality passport-style headshot portrait of this SAME person.

Requirements:
- Frame: Head and shoulders only, centered
- Background: Pure white (#FFFFFF)
- Lighting: Professional studio lighting, soft and even, no harsh shadows
- Expression: Neutral, natural expression
- Angle: Perfectly front-facing (face de face)
- The result must look like a professional mannequin reference photo
- Preserve the person's exact facial features, skin tone, and hair
- Do NOT add any text, watermark, or frame
- Output a single clean photo`;

const BODY_PROMPT = `You are a professional studio photographer.
Given the provided full-body photo of a person, generate a NEW high-quality full-body studio photo of this SAME person.

Requirements:
- Frame: Full body from head to feet, centered
- Background: Pure white (#FFFFFF)
- Clothing: Simple, neutral clothing (white t-shirt and dark pants)
- Pose: Standing straight, arms relaxed at sides, front-facing (vu de face)
- Lighting: Professional studio lighting, soft and even
- Preserve the person's exact body proportions, height, skin tone, and facial features
- The result must look like a professional mannequin reference photo
- Do NOT add any text, watermark, or frame
- Output a single clean photo`;

/**
 * Process a mannequin generation job
 */
export async function processMannequinJob(payload: MannequinJobPayload): Promise<void> {
  const { profileId, correlationId, mannequinId, originalImageBucket, originalImageKey } = payload;
  const supabase = getSupabase();

  logger.info('Processing mannequin studio job', {
    action: 'mannequin_process_start',
    correlation_id: correlationId,
    meta: { mannequinId, profileId },
  });

  try {
    // 1. Download original photo from R2
    const originalResponse = await downloadObject(originalImageBucket, originalImageKey, correlationId);
    if (!originalResponse.body) {
      throw new Error('Failed to download original image from R2');
    }
    const originalBase64 = originalResponse.body.toString('base64');

    // 2. Get the model configured for mannequin generation
    const model = await getMannequinModel();
    logger.info('Using model for mannequin generation', {
      action: 'mannequin_model_selected',
      correlation_id: correlationId,
      meta: { model },
    });

    // 3. Generate face studio photo
    logger.info('Generating face studio photo', {
      action: 'mannequin_face_generate',
      correlation_id: correlationId,
    });

    const faceResult = await generateImage(
      originalBase64,
      { prompt: FACE_PROMPT, model },
      correlationId
    );

    if (!faceResult.imageBase64) {
      throw new Error('AI failed to generate face studio photo');
    }

    // 4. Generate body studio photo
    logger.info('Generating body studio photo', {
      action: 'mannequin_body_generate',
      correlation_id: correlationId,
    });

    const bodyResult = await generateImage(
      originalBase64,
      { prompt: BODY_PROMPT, model },
      correlationId
    );

    if (!bodyResult.imageBase64) {
      throw new Error('AI failed to generate body studio photo');
    }

    // 5. Upload generated photos to R2
    const faceBuffer = Buffer.from(faceResult.imageBase64, 'base64');
    const faceKey = `mannequins/${profileId}/face_${Date.now()}.webp`;
    const faceUpload = await uploadToR2(faceKey, faceBuffer, 'image/webp');

    const bodyBuffer = Buffer.from(bodyResult.imageBase64, 'base64');
    const bodyKey = `mannequins/${profileId}/body_${Date.now()}.webp`;
    const bodyUpload = await uploadToR2(bodyKey, bodyBuffer, 'image/webp');

    // 6. Update mannequin record with generated images
    const { error: updateError } = await supabase
      .from('mannequins')
      .update({
        face_image_bucket: faceUpload.bucket,
        face_image_key: faceUpload.key,
        face_image_url: faceUpload.url,
        body_image_bucket: bodyUpload.bucket,
        body_image_key: bodyUpload.key,
        body_image_url: bodyUpload.url,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', mannequinId);

    if (updateError) {
      throw updateError;
    }

    logger.info('Mannequin studio generation complete', {
      action: 'mannequin_process_complete',
      correlation_id: correlationId,
      meta: { mannequinId, model },
    });
  } catch (error) {
    logger.error('Mannequin studio generation failed', {
      action: 'mannequin_process_error',
      correlation_id: correlationId,
      meta: { mannequinId, error: String(error) },
    });

    // Update mannequin status to 'error'
    await supabase
      .from('mannequins')
      .update({
        status: 'error',
        updated_at: new Date().toISOString(),
      })
      .eq('id', mannequinId);

    throw error;
  }
}
