/**
 * Mannequins API Routes
 * Handles custom mannequin photo upload and retrieval
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getSupabaseClient } from '../lib/supabase.js';
import { UnauthorizedError } from '../lib/errors.js';
import { logger } from '../logger.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// R2 upload helper
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

  return {
    bucket,
    key,
    url: `${publicUrl}/${key}`,
  };
}

const router: Router = Router();

// Validation schemas
const createMannequinSchema = z.object({
  faceImageBase64: z.string().min(1),
  bodyImageBase64: z.string().min(1),
  isCelebrityConfirmed: z.boolean().refine(val => val === true, {
    message: 'Must confirm that images do not represent a celebrity',
  }),
});

/**
 * POST /mannequins
 * Create or update user's mannequin
 */
router.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { faceImageBase64, bodyImageBase64, isCelebrityConfirmed } = createMannequinSchema.parse(req.body);
    const supabase = getSupabaseClient();
    const profileId = req.user.id;

    logger.info('Creating mannequin', {
      action: 'mannequin_create_start',
      correlation_id: req.correlationId,
      user_id: profileId,
    });

    // Upload face image to R2
    const faceBuffer = Buffer.from(faceImageBase64, 'base64');
    const faceKey = `mannequins/${profileId}/face_${Date.now()}.webp`;
    const faceUpload = await uploadToR2(faceKey, faceBuffer, 'image/webp');

    // Upload body image to R2
    const bodyBuffer = Buffer.from(bodyImageBase64, 'base64');
    const bodyKey = `mannequins/${profileId}/body_${Date.now()}.webp`;
    const bodyUpload = await uploadToR2(bodyKey, bodyBuffer, 'image/webp');

    // Check if mannequin already exists
    const { data: existing } = await supabase
      .from('mannequins')
      .select('id')
      .eq('profile_id', profileId)
      .single();

    if (existing) {
      // Update existing mannequin
      const { error: updateError } = await supabase
        .from('mannequins')
        .update({
          face_image_bucket: faceUpload.bucket,
          face_image_key: faceUpload.key,
          face_image_url: faceUpload.url,
          body_image_bucket: bodyUpload.bucket,
          body_image_key: bodyUpload.key,
          body_image_url: bodyUpload.url,
          is_celebrity_confirmed: isCelebrityConfirmed,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        throw updateError;
      }

      logger.info('Mannequin updated', {
        action: 'mannequin_updated',
        correlation_id: req.correlationId,
        user_id: profileId,
        meta: { mannequinId: existing.id },
      });

      res.json({
        mannequin: {
          id: existing.id,
          faceImageUrl: faceUpload.url,
          bodyImageUrl: bodyUpload.url,
        },
      });
    } else {
      // Create new mannequin
      const { data: newMannequin, error: insertError } = await supabase
        .from('mannequins')
        .insert({
          profile_id: profileId,
          face_image_bucket: faceUpload.bucket,
          face_image_key: faceUpload.key,
          face_image_url: faceUpload.url,
          body_image_bucket: bodyUpload.bucket,
          body_image_key: bodyUpload.key,
          body_image_url: bodyUpload.url,
          is_celebrity_confirmed: isCelebrityConfirmed,
          status: 'active',
        })
        .select('id')
        .single();

      if (insertError) {
        throw insertError;
      }

      logger.info('Mannequin created', {
        action: 'mannequin_created',
        correlation_id: req.correlationId,
        user_id: profileId,
        meta: { mannequinId: newMannequin.id },
      });

      res.json({
        mannequin: {
          id: newMannequin.id,
          faceImageUrl: faceUpload.url,
          bodyImageUrl: bodyUpload.url,
        },
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /mannequins/me
 * Get current user's mannequin
 */
router.get('/me', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const supabase = getSupabaseClient();
    const { data: mannequin, error } = await supabase
      .from('mannequins')
      .select('id, face_image_url, body_image_url, status, created_at, updated_at')
      .eq('profile_id', req.user.id)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    if (!mannequin) {
      res.json({ mannequin: null });
      return;
    }

    logger.info('Returning mannequin data', {
      action: 'mannequin_get_me',
      correlation_id: req.correlationId,
      user_id: req.user.id,
      meta: {
        faceImageUrl: mannequin.face_image_url,
        bodyImageUrl: mannequin.body_image_url,
      },
    });

    // Rewrite legacy URLs (media.kpata.ai) to the current public R2 URL
    const publicUrl = process.env.R2_PUBLIC_URL || '';
    const rewrite = (url: string) =>
      url.replace(/^https?:\/\/media\.kpata\.ai/, publicUrl);

    res.json({
      mannequin: {
        id: mannequin.id,
        faceImageUrl: rewrite(mannequin.face_image_url),
        bodyImageUrl: rewrite(mannequin.body_image_url),
        status: mannequin.status,
        createdAt: mannequin.created_at,
        updatedAt: mannequin.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /mannequins/me
 * Delete current user's mannequin
 */
router.delete('/me', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('mannequins')
      .delete()
      .eq('profile_id', req.user.id);

    if (error) {
      throw error;
    }

    logger.info('Mannequin deleted', {
      action: 'mannequin_deleted',
      correlation_id: req.correlationId,
      user_id: req.user.id,
    });

    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

export default router;
