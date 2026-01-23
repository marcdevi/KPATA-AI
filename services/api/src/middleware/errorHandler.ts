/**
 * Error Handler Middleware for KPATA AI API
 */

import { ErrorCode } from '@kpata/shared';
import { Request, Response, NextFunction } from 'express';

import { ApiError } from '../lib/errors.js';
import { logger } from '../logger.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const correlationId = req.correlationId || 'unknown';

  if (err instanceof ApiError) {
    logger.warn('API error', {
      action: 'api_error',
      correlation_id: correlationId,
      meta: {
        statusCode: err.statusCode,
        code: err.code,
        message: err.message,
        path: req.path,
        method: req.method,
      },
    });

    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  logger.error('Unhandled error', {
    action: 'unhandled_error',
    correlation_id: correlationId,
    meta: {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    },
  });

  res.status(500).json({
    error: {
      message: 'Internal server error',
      code: ErrorCode.SYSTEM_INTERNAL_ERROR,
    },
  });
}
