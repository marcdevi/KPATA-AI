/**
 * Storage for KPATA AI Telegram Bot
 * Upload photos to R2
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

import { config } from './config.js';

let s3Client: S3Client | null = null;

/**
 * Get S3 client for R2
 */
function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: config.r2.endpoint,
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
    });
  }
  return s3Client;
}

/**
 * Upload photo to R2 raw bucket
 * @param profileId - User profile ID
 * @param messageId - Telegram message ID (for idempotency)
 * @param fileUrl - Telegram file URL
 * @returns R2 key or null on error
 */
export async function uploadPhotoToR2(
  profileId: string,
  messageId: string,
  fileUrl: string
): Promise<string | null> {
  try {
    // Download from Telegram
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Generate R2 key
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const key = `uploads/${year}/${month}/${profileId}/tg_${messageId}.jpg`;

    // Upload to R2
    const s3 = getS3Client();
    await s3.send(new PutObjectCommand({
      Bucket: config.r2.bucketRaw,
      Key: key,
      Body: buffer,
      ContentType: 'image/jpeg',
      Metadata: {
        'x-source': 'telegram',
        'x-message-id': messageId,
        'x-profile-id': profileId,
      },
    }));

    return key;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('R2 upload error:', error);
    return null;
  }
}
