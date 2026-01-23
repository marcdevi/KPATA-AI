/**
 * Authentication Middleware for KPATA AI Telegram Bot
 * Ensures user has phone and accepted terms before proceeding
 */

import { BotContext } from '../types.js';

/**
 * Check if user is fully authenticated (has phone + accepted terms)
 */
export function isAuthenticated(ctx: BotContext): boolean {
  return !!(ctx.session.profileId && ctx.session.hasAcceptedTerms);
}

/**
 * Auth middleware - blocks users without CGU acceptance
 */
export async function authMiddleware(ctx: BotContext, next: () => Promise<void>): Promise<void> {
  // Allow /start command always
  if (ctx.message?.text === '/start') {
    await next();
    return;
  }

  // Check if awaiting phone input
  if (ctx.session.awaitingPhone) {
    await next();
    return;
  }

  // Check if awaiting terms acceptance
  if (ctx.session.awaitingTermsAcceptance) {
    await next();
    return;
  }

  // Block if no profile
  if (!ctx.session.profileId) {
    await ctx.reply(
      '👋 Bienvenue sur KPATA AI !\n\n' +
      'Pour commencer, tape /start pour t\'inscrire.'
    );
    return;
  }

  // Block if terms not accepted
  if (!ctx.session.hasAcceptedTerms) {
    await ctx.reply(
      '⚠️ Tu dois accepter les Conditions Générales d\'Utilisation pour continuer.\n\n' +
      'Tape /start pour recommencer.'
    );
    return;
  }

  await next();
}
