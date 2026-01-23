/**
 * KPATA AI Media Worker
 * Cloudflare Worker for secure media access on media.kpata.ai
 * 
 * Features:
 * - JWT/HMAC token validation for secure access
 * - Path prefix validation (userId)
 * - R2 bucket fetch and serve
 * - Thumbnail generation with size whitelist (64/128/256/512)
 * - Proper cache headers
 */

import { ErrorCode } from '@kpata/shared';

import {
  parseThumbnailRequest,
  isAllowedSize,
  getAllowedSizes,
  getThumbnailCacheHeaders,
  getImageCacheHeaders,
} from './lib/resize.js';
import { validateMediaToken, validatePathPrefix } from './lib/token.js';

export interface Env {
  MEDIA_BUCKET: R2Bucket;
  GALLERY_BUCKET: R2Bucket;
  ENVIRONMENT: string;
  MEDIA_TOKEN_SECRET: string;
}

interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  timestamp: string;
  correlation_id?: string;
  user_id?: string;
  component: string;
  action: string;
  duration_ms?: number;
  error_code?: string;
  meta?: Record<string, unknown>;
  message: string;
}

function log(entry: Omit<LogEntry, 'timestamp'>): void {
  const fullEntry: LogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(fullEntry));
}

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

function errorResponse(message: string, status: number, errorCode?: string): Response {
  return jsonResponse({ error: message, code: errorCode }, status);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();
    const startTime = Date.now();

    log({
      level: 'info',
      correlation_id: correlationId,
      component: 'media-worker',
      action: 'request_received',
      meta: {
        method: request.method,
        path: url.pathname,
        environment: env.ENVIRONMENT,
      },
      message: `Received ${request.method} request to ${url.pathname}`,
    });

    try {
      // Health check endpoint
      if (url.pathname === '/health') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
      }

      // Only GET requests allowed for media
      if (request.method !== 'GET') {
        return errorResponse('Method not allowed', 405);
      }

      // Extract token from query param or Authorization header
      const token = url.searchParams.get('token') || 
        request.headers.get('Authorization')?.replace('Bearer ', '');

      if (!token) {
        log({
          level: 'warn',
          correlation_id: correlationId,
          component: 'media-worker',
          action: 'auth_missing',
          duration_ms: Date.now() - startTime,
          message: 'Access denied: missing token',
        });
        return errorResponse('Access denied: missing token', 401, ErrorCode.AUTH_UNAUTHORIZED);
      }

      // Validate token
      const tokenResult = await validateMediaToken(token, env.MEDIA_TOKEN_SECRET);
      if (!tokenResult.valid || !tokenResult.payload) {
        log({
          level: 'warn',
          correlation_id: correlationId,
          component: 'media-worker',
          action: 'auth_invalid',
          duration_ms: Date.now() - startTime,
          meta: { error: tokenResult.error },
          message: `Access denied: ${tokenResult.error}`,
        });
        return errorResponse(`Access denied: ${tokenResult.error}`, 401, ErrorCode.AUTH_INVALID_TOKEN);
      }

      // Handle thumbnail requests: /thumb/{size}/gallery/...
      const thumbRequest = parseThumbnailRequest(url.pathname);
      if (thumbRequest) {
        return await handleThumbnailRequest(
          thumbRequest.originalPath,
          thumbRequest.size,
          tokenResult.payload,
          env,
          ctx,
          correlationId,
          startTime
        );
      }

      // Handle regular gallery requests: /gallery/...
      if (url.pathname.startsWith('/gallery/')) {
        const path = url.pathname.slice(1); // Remove leading /
        return await handleGalleryRequest(path, tokenResult.payload, env, correlationId, startTime);
      }

      log({
        level: 'warn',
        correlation_id: correlationId,
        component: 'media-worker',
        action: 'not_found',
        duration_ms: Date.now() - startTime,
        message: `Route not found: ${url.pathname}`,
      });

      return errorResponse('Not found', 404);
    } catch (error) {
      log({
        level: 'error',
        correlation_id: correlationId,
        component: 'media-worker',
        action: 'request_error',
        duration_ms: Date.now() - startTime,
        error_code: ErrorCode.SYSTEM_INTERNAL_ERROR,
        meta: { error: String(error) },
        message: 'Request processing failed',
      });

      return errorResponse('Internal server error', 500, ErrorCode.SYSTEM_INTERNAL_ERROR);
    }
  },
};

async function handleGalleryRequest(
  path: string,
  tokenPayload: { path: string; userId: string; exp: number; iat: number },
  env: Env,
  correlationId: string,
  startTime: number
): Promise<Response> {
  // Validate path prefix (userId must match)
  if (!validatePathPrefix(path, tokenPayload)) {
    log({
      level: 'warn',
      correlation_id: correlationId,
      component: 'media-worker',
      action: 'path_mismatch',
      duration_ms: Date.now() - startTime,
      user_id: tokenPayload.userId,
      meta: { requestedPath: path, tokenPath: tokenPayload.path },
      message: 'Access denied: path prefix mismatch',
    });
    return errorResponse('Access denied: unauthorized path', 403, ErrorCode.AUTH_UNAUTHORIZED);
  }

  // Fetch from R2
  const object = await env.GALLERY_BUCKET.get(path);
  if (!object) {
    log({
      level: 'warn',
      correlation_id: correlationId,
      component: 'media-worker',
      action: 'object_not_found',
      duration_ms: Date.now() - startTime,
      meta: { path },
      message: `Object not found: ${path}`,
    });
    return errorResponse('Not found', 404);
  }

  log({
    level: 'info',
    correlation_id: correlationId,
    component: 'media-worker',
    action: 'serve_image',
    duration_ms: Date.now() - startTime,
    user_id: tokenPayload.userId,
    meta: { path, size: object.size },
    message: `Serving image: ${path}`,
  });

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'image/webp');
  headers.set('ETag', object.httpEtag);
  
  // Add cache headers
  const cacheHeaders = getImageCacheHeaders();
  for (const [key, value] of Object.entries(cacheHeaders)) {
    headers.set(key, value);
  }

  // Add correlation-id from metadata if present
  if (object.customMetadata?.['correlation-id']) {
    headers.set('X-Correlation-Id', object.customMetadata['correlation-id']);
  }

  return new Response(object.body, { headers });
}

async function handleThumbnailRequest(
  originalPath: string,
  size: number,
  tokenPayload: { path: string; userId: string; exp: number; iat: number },
  env: Env,
  _ctx: ExecutionContext,
  correlationId: string,
  startTime: number
): Promise<Response> {
  // Validate size
  if (!isAllowedSize(size)) {
    return errorResponse(`Invalid size. Allowed: ${getAllowedSizes().join(', ')}`, 400);
  }

  // Validate path prefix
  if (!validatePathPrefix(originalPath, tokenPayload)) {
    log({
      level: 'warn',
      correlation_id: correlationId,
      component: 'media-worker',
      action: 'thumb_path_mismatch',
      duration_ms: Date.now() - startTime,
      user_id: tokenPayload.userId,
      meta: { requestedPath: originalPath },
      message: 'Access denied: thumbnail path prefix mismatch',
    });
    return errorResponse('Access denied: unauthorized path', 403, ErrorCode.AUTH_UNAUTHORIZED);
  }

  // Check if pre-generated thumbnail exists
  const thumbKey = originalPath.replace(/\.[^.]+$/, `_thumb_${size}.webp`);
  const cachedThumb = await env.GALLERY_BUCKET.get(thumbKey);
  
  if (cachedThumb) {
    log({
      level: 'info',
      correlation_id: correlationId,
      component: 'media-worker',
      action: 'serve_cached_thumb',
      duration_ms: Date.now() - startTime,
      meta: { path: thumbKey, size },
      message: `Serving cached thumbnail: ${thumbKey}`,
    });

    const headers = new Headers();
    headers.set('Content-Type', 'image/webp');
    headers.set('ETag', cachedThumb.httpEtag);
    headers.set('X-Thumbnail-Cached', 'true');
    
    const cacheHeaders = getThumbnailCacheHeaders();
    for (const [key, value] of Object.entries(cacheHeaders)) {
      headers.set(key, value);
    }

    return new Response(cachedThumb.body, { headers });
  }

  // Fetch original image
  const original = await env.GALLERY_BUCKET.get(originalPath);
  if (!original) {
    return errorResponse('Original image not found', 404);
  }

  // Use Cloudflare Image Resizing if available (requires paid plan)
  // For now, return original with resize hint for client-side handling
  // In production, you'd use cf.image or a third-party service
  
  log({
    level: 'info',
    correlation_id: correlationId,
    component: 'media-worker',
    action: 'serve_thumb_original',
    duration_ms: Date.now() - startTime,
    meta: { path: originalPath, requestedSize: size },
    message: `Serving original for thumbnail (resize not available): ${originalPath}`,
  });

  const headers = new Headers();
  headers.set('Content-Type', original.httpMetadata?.contentType || 'image/webp');
  headers.set('ETag', original.httpEtag);
  headers.set('X-Thumbnail-Size', String(size));
  headers.set('X-Thumbnail-Cached', 'false');
  
  const cacheHeaders = getThumbnailCacheHeaders();
  for (const [key, value] of Object.entries(cacheHeaders)) {
    headers.set(key, value);
  }

  // Store thumbnail for future requests (background)
  // This would be implemented with actual image processing
  // ctx.waitUntil(generateAndStoreThumbnail(env, originalPath, size, original));

  return new Response(original.body, { headers });
}
