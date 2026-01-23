/**
 * Rate Limiting Middleware for KPATA AI Telegram Bot
 * 10 commands/min + 5min cooldown
 */

import { config } from '../config.js';
import { BotContext } from '../types.js';

const WINDOW_MS = 60 * 1000; // 1 minute
const COOLDOWN_MS = config.rateLimit.cooldownMinutes * 60 * 1000;

/**
 * Check and update rate limit for user
 * Returns true if allowed, false if rate limited
 */
export function checkRateLimit(ctx: BotContext): { allowed: boolean; message?: string } {
  const session = ctx.session;
  const now = Date.now();

  // Check if in cooldown
  if (session.cooldownUntil && now < session.cooldownUntil) {
    const remainingMinutes = Math.ceil((session.cooldownUntil - now) / 60000);
    return {
      allowed: false,
      message: `🛑 Wow doucement champion ! Tu es en pause pour encore ${remainingMinutes} minute(s). Profites-en pour prendre un café ☕`,
    };
  }

  // Reset cooldown if expired
  if (session.cooldownUntil && now >= session.cooldownUntil) {
    session.cooldownUntil = undefined;
    session.commandCount = 0;
    session.commandWindowStart = now;
  }

  // Check if window has expired
  if (now - session.commandWindowStart >= WINDOW_MS) {
    session.commandCount = 0;
    session.commandWindowStart = now;
  }

  // Increment command count
  session.commandCount++;

  // Check if over limit
  if (session.commandCount > config.rateLimit.maxCommandsPerMinute) {
    session.cooldownUntil = now + COOLDOWN_MS;
    return {
      allowed: false,
      message: `🛑 Wow doucement champion ! Tu as envoyé trop de commandes. Pause de ${config.rateLimit.cooldownMinutes} minutes. 😅`,
    };
  }

  return { allowed: true };
}

/**
 * Rate limit middleware
 */
export async function rateLimitMiddleware(ctx: BotContext, next: () => Promise<void>): Promise<void> {
  const result = checkRateLimit(ctx);

  if (!result.allowed) {
    await ctx.reply(result.message || 'Rate limit exceeded');
    return;
  }

  await next();
}
