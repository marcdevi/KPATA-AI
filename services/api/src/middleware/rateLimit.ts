/**
 * Rate Limiting Middleware for KPATA AI
 * Limits job creation rate and concurrent processing
 */

import { Request, Response, NextFunction } from 'express';

import { RateLimitError } from '../lib/errors.js';
import { getPricingConfig } from '../lib/pricing.js';
import { getSupabaseClient } from '../lib/supabase.js';

// In-memory rate limit store (for MVP - use Redis in production)
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > 120000) { // 2 minutes
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Every minute

/**
 * Check rate limit for job creation
 * Default: 6 jobs per minute per user
 */
export async function checkJobRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const config = await getPricingConfig();
  const maxPerMinute = config.maxJobsPerMinute;
  const windowMs = 60000; // 1 minute

  const key = `jobs:${userId}`;
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  if (!entry || now - entry.windowStart >= windowMs) {
    // New window
    entry = { count: 0, windowStart: now };
  }

  const remaining = Math.max(0, maxPerMinute - entry.count);
  const resetIn = Math.max(0, windowMs - (now - entry.windowStart));

  if (entry.count >= maxPerMinute) {
    return { allowed: false, remaining: 0, resetIn };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

  return { allowed: true, remaining: remaining - 1, resetIn };
}

/**
 * Check concurrent processing limit
 * Default: max 2 jobs processing simultaneously per user
 */
export async function checkConcurrentLimit(userId: string, maxConcurrent = 2): Promise<{ allowed: boolean; current: number }> {
  const supabase = getSupabaseClient();

  const { count, error } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', userId)
    .in('status', ['pending', 'queued', 'processing']);

  if (error) {
    // On error, allow the request but log
    // eslint-disable-next-line no-console
    console.error('Error checking concurrent jobs:', error);
    return { allowed: true, current: 0 };
  }

  const current = count || 0;
  return { allowed: current < maxConcurrent, current };
}

/**
 * Rate limit middleware for job creation
 */
export function jobRateLimitMiddleware(maxConcurrent = 2) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next();
      return;
    }

    const userId = req.user.id;

    // Check rate limit
    const rateResult = await checkJobRateLimit(userId);
    if (!rateResult.allowed) {
      const cooldownSeconds = Math.ceil(rateResult.resetIn / 1000);
      throw new RateLimitError(
        `Rate limit exceeded. Please wait ${cooldownSeconds} seconds before creating another job.`,
        { resetIn: rateResult.resetIn, cooldownSeconds }
      );
    }

    // Check concurrent limit
    const concurrentResult = await checkConcurrentLimit(userId, maxConcurrent);
    if (!concurrentResult.allowed) {
      throw new RateLimitError(
        `Maximum ${maxConcurrent} jobs can be processing at once. Please wait for current jobs to complete.`,
        { currentProcessing: concurrentResult.current, maxConcurrent }
      );
    }

    next();
  };
}

/**
 * Get cooldown message for bot responses
 */
export function getCooldownMessage(resetInMs: number, language = 'fr'): string {
  const seconds = Math.ceil(resetInMs / 1000);
  
  if (language === 'fr') {
    return `⏳ Veuillez patienter ${seconds} secondes avant de soumettre une nouvelle photo.`;
  }
  
  return `⏳ Please wait ${seconds} seconds before submitting another photo.`;
}
