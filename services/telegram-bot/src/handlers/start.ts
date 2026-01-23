/**
 * Start Handler for KPATA AI Telegram Bot
 * /start -> collect phone -> accept CGU -> menu
 */

import { InlineKeyboard } from 'grammy';

import { linkPhone, acceptTerms } from '../api.js';
import { BotContext } from '../types.js';

import { showMainMenu } from './menu.js';

/**
 * Handle /start command
 */
export async function handleStart(ctx: BotContext): Promise<void> {
  // Reset session for fresh start
  ctx.session.awaitingPhone = false;
  ctx.session.awaitingTermsAcceptance = false;
  ctx.session.currentFlow = undefined;
  ctx.session.flowStep = undefined;

  // Check if already registered
  if (ctx.session.profileId && ctx.session.hasAcceptedTerms) {
    await showMainMenu(ctx);
    return;
  }

  // Welcome message and request phone
  await ctx.reply(
    '👋 *Bienvenue sur KPATA AI !*\n\n' +
    '🎨 Je transforme tes photos de produits en visuels professionnels pour les réseaux sociaux.\n\n' +
    '📱 Pour commencer, j\'ai besoin de ton numéro de téléphone.\n\n' +
    '_Clique sur le bouton ci-dessous ou envoie-moi ton numéro au format +225XXXXXXXXXX_',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ text: '📱 Partager mon numéro', request_contact: true }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }
  );

  ctx.session.awaitingPhone = true;
}

/**
 * Handle contact sharing (phone number)
 */
export async function handleContact(ctx: BotContext): Promise<void> {
  if (!ctx.session.awaitingPhone) {
    return;
  }

  const contact = ctx.message?.contact;
  if (!contact?.phone_number) {
    await ctx.reply('❌ Je n\'ai pas pu récupérer ton numéro. Réessaie.');
    return;
  }

  // Normalize phone number
  let phoneE164 = contact.phone_number;
  if (!phoneE164.startsWith('+')) {
    phoneE164 = '+' + phoneE164;
  }

  await processPhoneNumber(ctx, phoneE164);
}

/**
 * Handle text message as phone number
 */
export async function handlePhoneText(ctx: BotContext): Promise<void> {
  if (!ctx.session.awaitingPhone) {
    return;
  }

  const text = ctx.message?.text?.trim();
  if (!text) {
    return;
  }

  // Basic phone validation
  const phoneRegex = /^\+?[0-9]{8,15}$/;
  if (!phoneRegex.test(text.replace(/\s/g, ''))) {
    await ctx.reply(
      '❌ Format invalide.\n\n' +
      'Envoie ton numéro au format +225XXXXXXXXXX ou utilise le bouton "Partager mon numéro".'
    );
    return;
  }

  let phoneE164 = text.replace(/\s/g, '');
  if (!phoneE164.startsWith('+')) {
    // Assume Côte d'Ivoire if no country code
    phoneE164 = '+225' + phoneE164;
  }

  await processPhoneNumber(ctx, phoneE164);
}

/**
 * Process phone number and link to profile
 */
async function processPhoneNumber(ctx: BotContext, phoneE164: string): Promise<void> {
  await ctx.reply('⏳ Vérification en cours...');

  const result = await linkPhone(phoneE164);

  if (result.error) {
    await ctx.reply(`❌ Erreur: ${result.error}\n\nRéessaie avec /start`);
    ctx.session.awaitingPhone = false;
    return;
  }

  ctx.session.profileId = result.profileId;
  ctx.session.phoneE164 = phoneE164;
  ctx.session.awaitingPhone = false;

  // Show terms acceptance
  await showTermsAcceptance(ctx, result.isNew || false);
}

/**
 * Show terms acceptance prompt
 */
async function showTermsAcceptance(ctx: BotContext, isNew: boolean): Promise<void> {
  const welcomeText = isNew
    ? '✅ *Compte créé avec succès !*\n\n'
    : '✅ *Connexion réussie !*\n\n';

  const keyboard = new InlineKeyboard()
    .text('✅ J\'accepte les CGU', 'accept_terms')
    .row()
    .text('❌ Je refuse', 'decline_terms');

  await ctx.reply(
    welcomeText +
    '📜 *Conditions Générales d\'Utilisation*\n\n' +
    'En utilisant KPATA AI, tu acceptes :\n' +
    '• Nos conditions d\'utilisation\n' +
    '• Notre politique de confidentialité\n' +
    '• L\'utilisation de tes images pour le traitement IA\n\n' +
    '👉 Lis les CGU complètes : kpata.ai/cgu\n\n' +
    '_Tu dois accepter pour continuer._',
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    }
  );

  ctx.session.awaitingTermsAcceptance = true;
}

/**
 * Handle terms acceptance callback
 */
export async function handleTermsCallback(ctx: BotContext): Promise<void> {
  const action = ctx.callbackQuery?.data;

  if (action === 'accept_terms') {
    if (!ctx.session.profileId) {
      await ctx.answerCallbackQuery({ text: 'Erreur: profil non trouvé' });
      return;
    }

    const result = await acceptTerms(ctx.session.profileId);

    if (result.error) {
      await ctx.answerCallbackQuery({ text: `Erreur: ${result.error}` });
      return;
    }

    ctx.session.hasAcceptedTerms = true;
    ctx.session.awaitingTermsAcceptance = false;

    await ctx.answerCallbackQuery({ text: '✅ CGU acceptées !' });
    await ctx.editMessageText('✅ *CGU acceptées !*\n\nBienvenue sur KPATA AI ! 🎉', {
      parse_mode: 'Markdown',
    });

    // Show main menu
    await showMainMenu(ctx);

  } else if (action === 'decline_terms') {
    ctx.session.awaitingTermsAcceptance = false;
    
    await ctx.answerCallbackQuery({ text: '❌ CGU refusées' });
    await ctx.editMessageText(
      '❌ *CGU refusées*\n\n' +
      'Tu ne peux pas utiliser KPATA AI sans accepter les CGU.\n\n' +
      'Tape /start si tu changes d\'avis.',
      { parse_mode: 'Markdown' }
    );
  }
}
