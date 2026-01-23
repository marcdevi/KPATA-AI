/**
 * Menu Handler for KPATA AI Telegram Bot
 * Main menu and navigation
 */

import { InlineKeyboard } from 'grammy';

import { getProfile } from '../api.js';
import { BotContext } from '../types.js';

/**
 * Show main menu
 */
export async function showMainMenu(ctx: BotContext): Promise<void> {
  // Get user profile for credits display
  let credits = 0;
  if (ctx.session.profileId) {
    const result = await getProfile(ctx.session.profileId);
    if (result.profile) {
      credits = result.profile.credits;
    }
  }

  const keyboard = new InlineKeyboard()
    .text('📸 Nouveau Visuel', 'new_visual')
    .row()
    .text('🖼️ Ma Galerie', 'my_gallery')
    .text('💰 Mes Crédits', 'my_credits')
    .row()
    .text('💬 Support', 'support');

  await ctx.reply(
    '🎨 *Menu Principal*\n\n' +
    `💰 Crédits disponibles: *${credits}*\n\n` +
    'Que veux-tu faire ?',
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    }
  );
}

/**
 * Handle menu callbacks
 */
export async function handleMenuCallback(ctx: BotContext): Promise<void> {
  const action = ctx.callbackQuery?.data;

  switch (action) {
    case 'my_gallery':
      await ctx.answerCallbackQuery();
      await ctx.reply(
        '🖼️ *Ma Galerie*\n\n' +
        'Ta galerie est accessible sur l\'app mobile ou sur kpata.ai/gallery\n\n' +
        '_Fonctionnalité bientôt disponible dans le bot !_',
        { parse_mode: 'Markdown' }
      );
      break;

    case 'my_credits':
      await handleCreditsMenu(ctx);
      break;

    case 'support':
      await ctx.answerCallbackQuery();
      await ctx.reply(
        '💬 *Support*\n\n' +
        'Besoin d\'aide ? Contacte-nous :\n\n' +
        '📧 Email: support@kpata.ai\n' +
        '📱 WhatsApp: +225 XX XX XX XX\n\n' +
        'Ou décris ton problème ici et notre équipe te répondra rapidement.',
        { parse_mode: 'Markdown' }
      );
      break;

    default:
      await ctx.answerCallbackQuery({ text: 'Action non reconnue' });
  }
}

/**
 * Handle credits menu
 */
async function handleCreditsMenu(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();

  let credits = 0;
  if (ctx.session.profileId) {
    const result = await getProfile(ctx.session.profileId);
    if (result.profile) {
      credits = result.profile.credits;
    }
  }

  const keyboard = new InlineKeyboard()
    .text('🛒 Acheter des crédits', 'buy_credits')
    .row()
    .text('🔙 Retour', 'back_to_menu');

  await ctx.reply(
    '💰 *Mes Crédits*\n\n' +
    `Solde actuel: *${credits} crédits*\n\n` +
    '📦 *Nos packs :*\n' +
    '• Pack Starter (5 crédits) - 1 500 FCFA\n' +
    '• Pack Standard (10 crédits) - 2 500 FCFA\n' +
    '• Pack Pro (30 crédits) - 6 000 FCFA\n\n' +
    '_1 crédit = 1 photo transformée_',
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    }
  );
}
