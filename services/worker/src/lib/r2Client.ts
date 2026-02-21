/**
 * R2 Client for KPATA AI Worker Service
 * Uses AWS SDK S3 client compatible with Cloudflare R2
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  type PutObjectCommandInput,
  type GetObjectCommandInput,
} from '@aws-sdk/client-s3';
import {
  R2_BUCKETS,
  generateRawUploadKey,
  generateGalleryKey,
  generateThumbnailKey,
  type R2KeyParams,
  type GalleryKeyParams,
  type ThumbnailSize,
} from '@kpata/shared';

import { logger } from '../logger.js';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl?: string;
}

export interface UploadOptions {
  correlationId: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  bucket: string;
  key: string;
  url: string;
}

function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2 configuration. Check R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    publicUrl: process.env.R2_PUBLIC_URL,
  };
}

function createS3Client(config: R2Config): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

let _client: S3Client | null = null;
let _config: R2Config | null = null;

function getClient(): { client: S3Client; config: R2Config } {
  if (!_client || !_config) {
    _config = getR2Config();
    _client = createS3Client(_config);
  }
  return { client: _client, config: _config };
}

/**
 * Upload raw image to R2
 */
export async function uploadRawImage(
  params: R2KeyParams,
  body: Buffer | Uint8Array | ReadableStream,
  options: UploadOptions
): Promise<UploadResult> {
  const { client, config } = getClient();
  const key = generateRawUploadKey(params);
  const bucket = R2_BUCKETS.RAW_UPLOAD;

  const input: PutObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: options.contentType || 'image/jpeg',
    Metadata: {
      'correlation-id': options.correlationId,
      ...options.metadata,
    },
  };

  const startTime = Date.now();

  try {
    await client.send(new PutObjectCommand(input));

    logger.info('Raw image uploaded to R2', {
      action: 'r2_upload_raw',
      correlation_id: options.correlationId,
      duration_ms: Date.now() - startTime,
      meta: { bucket, key },
    });

    return {
      bucket,
      key,
      url: `${config.publicUrl || ''}/${key}`,
    };
  } catch (error) {
    logger.error('Failed to upload raw image to R2', {
      action: 'r2_upload_raw_error',
      correlation_id: options.correlationId,
      duration_ms: Date.now() - startTime,
      meta: { bucket, key, error: String(error) },
    });
    throw error;
  }
}

/**
 * Upload processed image to gallery
 */
export async function uploadGalleryImage(
  params: GalleryKeyParams,
  body: Buffer | Uint8Array | ReadableStream,
  options: UploadOptions
): Promise<UploadResult> {
  const { client, config } = getClient();
  const key = generateGalleryKey(params);
  const bucket = R2_BUCKETS.PUBLIC_GALLERY;

  const input: PutObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: options.contentType || 'image/webp',
    Metadata: {
      'correlation-id': options.correlationId,
      'pipeline-version': String(params.pipelineVersion),
      ...options.metadata,
    },
  };

  const startTime = Date.now();

  try {
    await client.send(new PutObjectCommand(input));

    logger.info('Gallery image uploaded to R2', {
      action: 'r2_upload_gallery',
      correlation_id: options.correlationId,
      duration_ms: Date.now() - startTime,
      meta: { bucket, key },
    });

    // Generate public URL - use configured URL or construct default R2.dev URL
    const publicUrl = config.publicUrl || `https://pub-${config.accountId}.r2.dev`;

    return {
      bucket,
      key,
      url: `${publicUrl}/${key}`,
    };
  } catch (error) {
    logger.error('Failed to upload gallery image to R2', {
      action: 'r2_upload_gallery_error',
      correlation_id: options.correlationId,
      duration_ms: Date.now() - startTime,
      meta: { bucket, key, error: String(error) },
    });
    throw error;
  }
}

/**
 * Upload thumbnail to gallery
 */
export async function uploadThumbnail(
  params: Omit<GalleryKeyParams, 'variant'>,
  size: ThumbnailSize,
  body: Buffer | Uint8Array | ReadableStream,
  options: UploadOptions
): Promise<UploadResult> {
  const { client, config } = getClient();
  const key = generateThumbnailKey(params, size);
  const bucket = R2_BUCKETS.PUBLIC_GALLERY;

  const input: PutObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: 'image/webp',
    Metadata: {
      'correlation-id': options.correlationId,
      'thumbnail-size': String(size),
      ...options.metadata,
    },
  };

  const startTime = Date.now();

  try {
    await client.send(new PutObjectCommand(input));

    logger.info('Thumbnail uploaded to R2', {
      action: 'r2_upload_thumbnail',
      correlation_id: options.correlationId,
      duration_ms: Date.now() - startTime,
      meta: { bucket, key, size },
    });

    // Generate public URL - use configured URL or construct default R2.dev URL
    const publicUrl = config.publicUrl || `https://pub-${config.accountId}.r2.dev`;

    return {
      bucket,
      key,
      url: `${publicUrl}/${key}`,
    };
  } catch (error) {
    logger.error('Failed to upload thumbnail to R2', {
      action: 'r2_upload_thumbnail_error',
      correlation_id: options.correlationId,
      duration_ms: Date.now() - startTime,
      meta: { bucket, key, size, error: String(error) },
    });
    throw error;
  }
}

/**
 * Download object from R2 as Buffer
 */
export async function downloadObject(
  bucket: string,
  key: string,
  correlationId?: string
): Promise<{ body: Buffer | null; contentType: string | undefined; metadata: Record<string, string> }> {
  const { client } = getClient();

  const input: GetObjectCommandInput = {
    Bucket: bucket,
    Key: key,
  };

  const startTime = Date.now();

  try {
    const response = await client.send(new GetObjectCommand(input));

    // Convert stream to Buffer
    let bodyBuffer: Buffer | null = null;
    if (response.Body) {
      const byteArray = await response.Body.transformToByteArray();
      bodyBuffer = Buffer.from(byteArray);
    }

    logger.info('Object downloaded from R2', {
      action: 'r2_download',
      correlation_id: correlationId,
      duration_ms: Date.now() - startTime,
      meta: { bucket, key, size: bodyBuffer?.length },
    });

    return {
      body: bodyBuffer,
      contentType: response.ContentType,
      metadata: (response.Metadata as Record<string, string>) || {},
    };
  } catch (error) {
    logger.error('Failed to download object from R2', {
      action: 'r2_download_error',
      correlation_id: correlationId,
      duration_ms: Date.now() - startTime,
      meta: { bucket, key, error: String(error) },
    });
    throw error;
  }
}

/**
 * Get object metadata (HEAD request)
 */
export async function getObjectMetadata(
  bucket: string,
  key: string,
  correlationId?: string
): Promise<{ contentType: string | undefined; contentLength: number | undefined; metadata: Record<string, string> }> {
  const { client } = getClient();

  const startTime = Date.now();

  try {
    const response = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    logger.info('Object metadata retrieved from R2', {
      action: 'r2_head',
      correlation_id: correlationId,
      duration_ms: Date.now() - startTime,
      meta: { bucket, key },
    });

    return {
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      metadata: (response.Metadata as Record<string, string>) || {},
    };
  } catch (error) {
    logger.error('Failed to get object metadata from R2', {
      action: 'r2_head_error',
      correlation_id: correlationId,
      duration_ms: Date.now() - startTime,
      meta: { bucket, key, error: String(error) },
    });
    throw error;
  }
}

/**
 * Delete object from R2
 */
export async function deleteObject(bucket: string, key: string, correlationId?: string): Promise<void> {
  const { client } = getClient();

  const startTime = Date.now();

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    logger.info('Object deleted from R2', {
      action: 'r2_delete',
      correlation_id: correlationId,
      duration_ms: Date.now() - startTime,
      meta: { bucket, key },
    });
  } catch (error) {
    logger.error('Failed to delete object from R2', {
      action: 'r2_delete_error',
      correlation_id: correlationId,
      duration_ms: Date.now() - startTime,
      meta: { bucket, key, error: String(error) },
    });
    throw error;
  }
}

export { R2_BUCKETS, generateRawUploadKey, generateGalleryKey, generateThumbnailKey };
