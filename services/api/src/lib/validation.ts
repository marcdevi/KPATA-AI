/**
 * Zod Validation Utilities for KPATA AI API
 */

import { z, ZodError, ZodSchema, ZodIssue } from 'zod';

import { BadRequestError } from './errors.js';

/**
 * Validate request body against a Zod schema
 */
export function validateBody<T>(schema: ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.issues.map((e: ZodIssue) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      throw new BadRequestError('Validation failed', { errors: details });
    }
    throw error;
  }
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQuery<T>(schema: ZodSchema<T>, data: unknown): T {
  return validateBody(schema, data);
}

/**
 * Common validation schemas
 */
export const schemas = {
  uuid: z.string().uuid(),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/, 'Invalid E.164 phone number'),
  email: z.string().email(),
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
};

export { z };
