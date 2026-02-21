/**
 * Job Processor for KPATA AI Worker
 * Main processing pipeline for image jobs
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';

import { handleDeadLetter } from './lib/dlq.js';
import { generatePrompt, generateImage, generatePlaceholderImage } from './lib/openrouter.js';
import { ProcessorContext, NonRetryableError, shouldRetry } from './lib/queue.js';
import { uploadGalleryImage, uploadThumbnail, downloadObject } from './lib/r2Client.js';
import { createStageTimer } from './lib/stage.js';
import { logger } from './logger.js';

let supabaseClient: SupabaseClient | null = null;

// Image dimensions for different formats
const IMAGE_FORMATS = {
  instagram: { width: 1080, height: 1080, variant: 'instagram' },
  whatsapp: { width: 1080, height: 1920, variant: 'whatsapp' },
} as const;

const THUMBNAIL_SIZES = [150, 300] as const;

/**
 * Get Supabase client (singleton)
 */
function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}

/**
 * Update job status in database
 */
async function updateJobStatus(
  jobId: string,
  status: string,
  extra?: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabase();
  
  const updateData: Record<string, unknown> = {
    status,
    ...extra,
  };

  if (status === 'processing') {
    updateData.processing_started_at = new Date().toISOString();
  } else if (status === 'completed') {
    updateData.completed_at = new Date().toISOString();
  }

  await supabase
    .from('jobs')
    .update(updateData)
    .eq('id', jobId);
}

/**
 * Main job processor
 */
export async function processJob(ctx: ProcessorContext): Promise<void> {
  const { job, correlationId, attempt } = ctx;
  const { jobId, profileId, category, backgroundStyle, inputImageBase64, mannequinMode, mannequinFaceBucket, mannequinFaceKey, mannequinBodyBucket, mannequinBodyKey, customPrompt } = job.data;

  // eslint-disable-next-line no-console
  console.log(`[${correlationId}] Processing job ${jobId} (attempt ${attempt})`);

  const timer = createStageTimer(jobId, correlationId);

  try {
    // Update status to processing
    await updateJobStatus(jobId, 'processing', { attempt_count: attempt });

    // Stage 1: Validate input
    await timer.withStage('validate', async () => {
      await validateInput(job.data, correlationId);
    });

    // Stage 2: Download input image
    await timer.withStage('download', async () => {
      await downloadInputImage(jobId, inputImageBase64, correlationId);
    });

    // Stage 3: Process with AI
    await timer.withStage('ai_process', async () => {
      await processWithAI(jobId, category, backgroundStyle, correlationId, mannequinMode, mannequinFaceBucket, mannequinFaceKey, mannequinBodyBucket, mannequinBodyKey, customPrompt);
    });

    // Stage 4: Upload result
    await timer.withStage('upload', async () => {
      await uploadResult(jobId, profileId, correlationId);
    });

    // Stage 5: Generate thumbnail
    await timer.withStage('thumbnail', async () => {
      await generateThumbnail(jobId, profileId, correlationId);
    });

    // Save stage durations
    await timer.saveDurations();

    // Update status to completed
    await updateJobStatus(jobId, 'completed', {
      stage_durations: timer.getDurations(),
      duration_ms_total: timer.getTotalDuration(),
    });

    // eslint-disable-next-line no-console
    console.log(`[${correlationId}] Job ${jobId} completed in ${timer.getTotalDuration()}ms`);

  } catch (error) {
    // Save durations even on failure
    await timer.saveDurations();

    // Check if we should retry
    if (error instanceof Error) {
      const canRetry = shouldRetry(error, attempt);

      if (!canRetry || attempt >= 3) {
        // Move to DLQ
        await handleDeadLetter(job, error, correlationId);
      } else {
        // Update job with error info for retry
        await updateJobStatus(jobId, 'queued', {
          last_error_code: 'errorCode' in error ? error.errorCode : 'PROCESSING_ERROR',
          last_error_message: error.message,
          attempt_count: attempt,
        });
      }
    }

    throw error; // Re-throw to let BullMQ handle retry
  }
}

// Store processed image data between stages
interface ProcessingState {
  inputImageBuffer?: Buffer;
  processedImageBase64?: string;
  model?: string;
  provider?: string;
  uploadedAssets: Array<{
    bucket: string;
    key: string;
    url: string;
    type: string;
    width: number;
    height: number;
    sizeBytes: number;
  }>;
}

const processingStates = new Map<string, ProcessingState>();

/**
 * Stage: Validate input data
 */
async function validateInput(
  data: ProcessorContext['job']['data'],
  correlationId: string
): Promise<void> {
  console.log(`[${correlationId}] Validating input...`);

  // Check required fields
  if (!data.jobId || !data.profileId) {
    throw new NonRetryableError('Missing required fields', 'VALIDATION_FAILED');
  }

  // Initialize processing state
  processingStates.set(data.jobId, { uploadedAssets: [] });

  logger.debug('Input validated', {
    action: 'validate_input',
    correlation_id: correlationId,
    meta: { jobId: data.jobId, category: data.category, backgroundStyle: data.backgroundStyle },
  });
}

/**
 * Stage: Download input image from queue data or use placeholder
 */
async function downloadInputImage(
  jobId: string,
  inputImageBase64: string | undefined,
  correlationId: string
): Promise<void> {
  console.log(`[${correlationId}] Downloading input image...`);

  const state = processingStates.get(jobId);
  if (!state) throw new Error('Processing state not found');

  if (inputImageBase64) {
    // Use uploaded image from mobile app
    state.inputImageBuffer = Buffer.from(inputImageBase64, 'base64');
    logger.debug('Using uploaded input image', {
      action: 'download_input',
      correlation_id: correlationId,
      meta: { jobId, size: state.inputImageBuffer.length },
    });
  } else {
    // Fallback: Generate a placeholder PNG image for testing
    const placeholderBase64 = await generatePlaceholderImage(1080, 1080, '#4f46e5');
    state.inputImageBuffer = Buffer.from(placeholderBase64, 'base64');
    logger.debug('Using placeholder input image', {
      action: 'download_input',
      correlation_id: correlationId,
      meta: { jobId, size: state.inputImageBuffer.length },
    });
  }
}

/**
 * Stage: Process image with AI
 */
async function processWithAI(
  jobId: string,
  category: string,
  backgroundStyle: string,
  correlationId: string,
  mannequinMode?: string,
  mannequinFaceBucket?: string,
  mannequinFaceKey?: string,
  mannequinBodyBucket?: string,
  mannequinBodyKey?: string,
  customPrompt?: string
): Promise<void> {
  console.log(`[${correlationId}] Processing with AI: category=${category}, style=${backgroundStyle}...`);

  const state = processingStates.get(jobId);
  if (!state || !state.inputImageBuffer) throw new Error('Processing state not found');

  // Use custom prompt if provided (e.g. from voice input), otherwise generate from category/style
  const { prompt: generatedPrompt } = generatePrompt(category, backgroundStyle);
  const prompt = customPrompt || generatedPrompt;

  // Download mannequin images if provided
  let mannequinFaceBase64: string | undefined;
  let mannequinBodyBase64: string | undefined;

  if (mannequinFaceBucket && mannequinFaceKey && mannequinBodyBucket && mannequinBodyKey) {
    try {
      logger.info('Downloading mannequin images from R2', {
        action: 'download_mannequin',
        correlation_id: correlationId,
        meta: { jobId, faceBucket: mannequinFaceBucket, faceKey: mannequinFaceKey },
      });

      // Download face image from R2
      const faceResponse = await downloadObject(mannequinFaceBucket, mannequinFaceKey, correlationId);
      if (faceResponse.body) {
        mannequinFaceBase64 = faceResponse.body.toString('base64');
      }

      // Download body image from R2
      const bodyResponse = await downloadObject(mannequinBodyBucket, mannequinBodyKey, correlationId);
      if (bodyResponse.body) {
        mannequinBodyBase64 = bodyResponse.body.toString('base64');
      }

      logger.info('Mannequin images downloaded from R2', {
        action: 'mannequin_downloaded',
        correlation_id: correlationId,
        meta: { jobId, hasFace: !!mannequinFaceBase64, hasBody: !!mannequinBodyBase64 },
      });
    } catch (error) {
      logger.error('Failed to download mannequin images from R2', {
        action: 'mannequin_download_error',
        correlation_id: correlationId,
        meta: { error: String(error) },
      });
    }
  }

  // Select model based on mannequin mode
  // Custom mannequin mode uses gemini-3-pro-image-preview (2 credits)
  // All other modes use gemini-2.5-flash-image (1 credit)
  const defaultModel = mannequinMode === 'custom' 
    ? 'google/gemini-3-pro-image-preview'
    : 'google/gemini-2.5-flash-image';
  const model = process.env.OPENROUTER_MODEL || defaultModel;

  // Check if OpenRouter API is configured
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;

  if (hasOpenRouter) {
    try {
      // Call OpenRouter API for image analysis/processing
      const result = await generateImage(
        state.inputImageBuffer.toString('base64'),
        { prompt, width: 1080, height: 1080, model, mannequinFaceBase64, mannequinBodyBase64 },
        correlationId
      );
      state.processedImageBase64 = result.imageBase64;
      state.model = result.model;
      state.provider = result.provider;
    } catch (error) {
      logger.warn('OpenRouter processing failed, using placeholder', {
        action: 'ai_fallback',
        correlation_id: correlationId,
        meta: { error: String(error) },
      });
      // Fallback to placeholder PNG
      state.processedImageBase64 = await generatePlaceholderImage(1080, 1080, '#10b981');
      state.model = 'placeholder';
      state.provider = 'local';
    }
  } else {
    // No API key - use placeholder
    logger.info('OpenRouter not configured, using placeholder image', {
      action: 'ai_placeholder',
      correlation_id: correlationId,
    });
    state.processedImageBase64 = await generatePlaceholderImage(1080, 1080, '#10b981');
    state.model = 'placeholder';
    state.provider = 'local';
  }

  logger.debug('AI processing complete', {
    action: 'ai_process_complete',
    correlation_id: correlationId,
    meta: { jobId, model: state.model, provider: state.provider },
  });
}

/**
 * Stage: Upload result to R2 and create assets in database
 */
async function uploadResult(
  jobId: string,
  profileId: string,
  correlationId: string
): Promise<void> {
  console.log(`[${correlationId}] Uploading result...`);

  const state = processingStates.get(jobId);
  if (!state || !state.processedImageBase64) throw new Error('Processing state not found');

  const supabase = getSupabase();
  const hasR2 = !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);

  // Generate images for each format
  for (const [formatName, format] of Object.entries(IMAGE_FORMATS)) {
    try {
      // Convert base64 to buffer and resize
      const inputBuffer = Buffer.from(state.processedImageBase64, 'base64');
      const resizedBuffer = await sharp(inputBuffer)
        .resize(format.width, format.height, { fit: 'cover' })
        .webp({ quality: 85 })
        .toBuffer();

      let assetUrl = '';
      let bucket = 'kpata-gallery';
      let key = `gallery/${profileId}/${jobId}/v1/${formatName}.webp`;

      if (hasR2) {
        // Upload to R2
        const uploadResult = await uploadGalleryImage(
          { userId: profileId, jobId, pipelineVersion: 1, variant: format.variant },
          resizedBuffer,
          { correlationId, contentType: 'image/webp' }
        );
        bucket = uploadResult.bucket;
        key = uploadResult.key;
        assetUrl = uploadResult.url;
      } else {
        // No R2 - store as data URL in metadata (for dev only)
        assetUrl = `data:image/webp;base64,${resizedBuffer.toString('base64').substring(0, 100)}...`;
        logger.warn('R2 not configured, asset URL will be placeholder', {
          action: 'upload_no_r2',
          correlation_id: correlationId,
        });
      }

      // Create asset record in database
      const { error: assetError } = await supabase.from('assets').insert({
        owner_profile_id: profileId,
        job_id: jobId,
        bucket,
        key,
        type: 'output_image',
        content_type: 'image/webp',
        size_bytes: resizedBuffer.length,
        width: format.width,
        height: format.height,
        metadata: {
          format: formatName,
          variant: format.variant,
          pipeline_version: 1,
          model: state.model,
          provider: state.provider,
          url: assetUrl,
        },
      });

      if (assetError) {
        logger.error('Failed to create asset record', {
          action: 'asset_insert_error',
          correlation_id: correlationId,
          meta: { error: assetError.message },
        });
      }

      state.uploadedAssets.push({
        bucket,
        key,
        url: assetUrl,
        type: formatName,
        width: format.width,
        height: format.height,
        sizeBytes: resizedBuffer.length,
      });

      logger.info('Asset uploaded', {
        action: 'asset_uploaded',
        correlation_id: correlationId,
        meta: { format: formatName, size: resizedBuffer.length },
      });
    } catch (error) {
      logger.error('Failed to process format', {
        action: 'format_error',
        correlation_id: correlationId,
        meta: { format: formatName, error: String(error) },
      });
    }
  }
}

/**
 * Stage: Generate thumbnails
 */
async function generateThumbnail(
  jobId: string,
  profileId: string,
  correlationId: string
): Promise<void> {
  console.log(`[${correlationId}] Generating thumbnail...`);

  const state = processingStates.get(jobId);
  if (!state || !state.processedImageBase64) throw new Error('Processing state not found');

  const hasR2 = !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);

  for (const size of THUMBNAIL_SIZES) {
    try {
      const inputBuffer = Buffer.from(state.processedImageBase64, 'base64');
      const thumbBuffer = await sharp(inputBuffer)
        .resize(size, size, { fit: 'cover' })
        .webp({ quality: 70 })
        .toBuffer();

      if (hasR2) {
        await uploadThumbnail(
          { userId: profileId, jobId, pipelineVersion: 1 },
          size,
          thumbBuffer,
          { correlationId, contentType: 'image/webp' }
        );
      }

      logger.debug('Thumbnail generated', {
        action: 'thumbnail_generated',
        correlation_id: correlationId,
        meta: { size, bytes: thumbBuffer.length },
      });
    } catch (error) {
      logger.warn('Failed to generate thumbnail', {
        action: 'thumbnail_error',
        correlation_id: correlationId,
        meta: { size, error: String(error) },
      });
    }
  }

  // Cleanup processing state
  processingStates.delete(jobId);
}
