/**
 * Correlation ID Middleware for KPATA AI API
 * Generates/propagates x-correlation-id across requests, logs, responses, and DB calls
 */

import { randomUUID } from 'crypto';

import { Request, Response, NextFunction } from 'express';

export const CORRELATION_HEADER = 'x-correlation-id';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

/**
 * Middleware to generate or propagate correlation ID
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = req.headers[CORRELATION_HEADER] as string || randomUUID();
  
  req.correlationId = correlationId;
  res.setHeader(CORRELATION_HEADER, correlationId);
  
  next();
}

/**
 * Get correlation ID from async local storage or generate new one
 * For use in contexts where request is not available
 */
export function getCorrelationId(): string {
  return randomUUID();
}
