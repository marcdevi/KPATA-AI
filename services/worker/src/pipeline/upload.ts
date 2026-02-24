/**
 * Upload & Job Update for KPATA AI Worker
 * Upload outputs to R2, update assets and job status
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { R2_BUCKETS } from '@kpata/shared';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const PIPELINE_VERSION = 1;

let supabaseClient: SupabaseClient | null = null;
let s3Client: S3Client | null = null;

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

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    });
  }
  return s3Client;
}

export interface UploadResult {
  galleryKey: string;
  thumbnailKey: string;
  assetId: string;
}

export interface JobMetrics {
  modelUsed: string;
  providerUsed: string;
  costActual?: number;
  durationMsTotal: number;
  stageDurations: Record<string, number>;
}

/**
 * Upload output images to R2 gallery bucket
 */
export async function uploadToGallery(
  profileId: string,
  jobId: string,
  outputBuffer: Buffer,
  thumbnailBuffer: Buffer,
  contentType: string,
  correlationId: string
): Promise<UploadResult> {
  const s3 = getS3Client();
  const supabase = getSupabase();

  // Generate keys
  const galleryKey = `gallery/${profileId}/${jobId}/v${PIPELINE_VERSION}/optimized.webp`;
  const thumbnailKey = `gallery/${profileId}/${jobId}/v${PIPELINE_VERSION}/thumb_256.webp`;

  // Upload main image
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKETS.PUBLIC_GALLERY,
    Key: galleryKey,
    Body: outputBuffer,
    ContentType: contentType,
    Metadata: {
      'x-correlation-id': correlationId,
      'x-job-id': jobId,
      'x-profile-id': profileId,
    },
  }));

  // Upload thumbnail
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKETS.PUBLIC_GALLERY,
    Key: thumbnailKey,
    Body: thumbnailBuffer,
    ContentType: contentType,
    Metadata: {
      'x-correlation-id': correlationId,
      'x-job-id': jobId,
    },
  }));

  // Create asset record
  const { data: asset, error } = await supabase
    .from('assets')
    .insert({
      owner_profile_id: profileId,
      job_id: jobId,
      bucket: R2_BUCKETS.PUBLIC_GALLERY,
      key: galleryKey,
      type: 'output_image',
      content_type: contentType,
      size_bytes: outputBuffer.length,
      metadata: {
        thumbnail_key: thumbnailKey,
        correlation_id: correlationId,
      },
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create asset record: ${error.message}`);
  }

  return {
    galleryKey,
    thumbnailKey,
    assetId: asset.id,
  };
}

/**
 * Update job status to delivered with metrics
 */
export async function updateJobDelivered(
  jobId: string,
  metrics: JobMetrics,
  correlationId: string
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('jobs')
    .update({
      status: 'completed',
      model_used: metrics.modelUsed,
      provider_used: metrics.providerUsed,
      duration_ms_total: metrics.durationMsTotal,
      stage_durations: metrics.stageDurations,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    // eslint-disable-next-line no-console
    console.error(`[${correlationId}] Failed to update job status: ${error.message}`);
    throw error;
  }
}

/**
 * Get job details for processing
 */
export async function getJobDetails(jobId: string): Promise<{
  profileId: string;
  category: string;
  backgroundStyle: string;
  templateLayout: string;
  mannequinMode: string;
  sourceChannel: string;
  userRole: string;
} | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('jobs')
    .select(`
      profile_id,
      category,
      background_style,
      template_layout,
      mannequin_mode,
      source_channel,
      profiles!inner(role)
    `)
    .eq('id', jobId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    profileId: data.profile_id,
    category: data.category,
    backgroundStyle: data.background_style,
    templateLayout: data.template_layout,
    mannequinMode: data.mannequin_mode,
    sourceChannel: data.source_channel,
    userRole: (data.profiles as unknown as { role: string }).role,
  };
}

/**
 * Get input image from R2 for a job
 */
export async function getInputImage(jobId: string): Promise<Buffer | null> {
  const supabase = getSupabase();

  // Find input asset for this job
  const { data: asset } = await supabase
    .from('assets')
    .select('bucket, key')
    .eq('job_id', jobId)
    .eq('type', 'input_image')
    .single();

  if (!asset) {
    return null;
  }

  // Download from R2
  // For MVP, return null - actual implementation would download from R2
  // const s3 = getS3Client();
  // const response = await s3.send(new GetObjectCommand({
  //   Bucket: asset.bucket,
  //   Key: asset.key,
  // }));
  // return Buffer.from(await response.Body.transformToByteArray());

  return null;
}
