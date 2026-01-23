/**
 * Standardized API Errors for KPATA AI
 */

import { ErrorCode } from '@kpata/shared';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    code: ErrorCode,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, ErrorCode.VALIDATION_FAILED, details);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(message, 401, ErrorCode.AUTH_UNAUTHORIZED);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super(message, 403, ErrorCode.AUTH_UNAUTHORIZED);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Not found', details?: Record<string, unknown>) {
    super(message, 404, ErrorCode.RESOURCE_NOT_FOUND, details);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 409, ErrorCode.RESOURCE_ALREADY_EXISTS, details);
    this.name = 'ConflictError';
  }
}

export class InternalError extends ApiError {
  constructor(message = 'Internal server error') {
    super(message, 500, ErrorCode.SYSTEM_INTERNAL_ERROR);
    this.name = 'InternalError';
  }
}

export class InsufficientCreditsError extends ApiError {
  constructor(required: number, available: number) {
    super('Insufficient credits', 402, ErrorCode.CREDITS_INSUFFICIENT, {
      required,
      available,
    });
    this.name = 'InsufficientCreditsError';
  }
}

export class RateLimitError extends ApiError {
  constructor(message = 'Rate limit exceeded', details?: Record<string, unknown>) {
    super(message, 429, ErrorCode.RATE_LIMIT_EXCEEDED, details);
    this.name = 'RateLimitError';
  }
}
