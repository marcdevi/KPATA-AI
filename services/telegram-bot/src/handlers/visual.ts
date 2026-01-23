/**
 * Visual Flow Handler for KPATA AI Telegram Bot
 * New visual creation flow: category -> background -> template -> mannequin -> photo
 */

import { InlineKeyboard } from 'grammy';

import { createJob } from '../api.js';
import { uploadPhotoToR2 } from '../storage.js';
import { BotContext, CATEGORIES, BACKGROUNDS, TEMPLATES, MANNEQUINS } from '../types.js';

/**
 * Start new visual flow
 */
export async function startNewVisualFlow(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();

  // Reset flow state
  ctx.session.currentFlow = 'new_visual';
  ctx.session.flowStep = 'category';
  ctx.session.jobOptions = {};

  await showCategorySelection(ctx);
}

/**
 * Show category selection
 */
async function showCategorySelection(ctx: BotContext): Promise<void> {
  const keyboard = new InlineKeyboard();

  // Add category buttons (2 per row)
  for (let i = 0; i < CATEGORIES.length; i += 2) {
    const row = CATEGORIES.slice(i, i + 2);
    for (const cat of row) {
      keyboard.text(cat.label, `category_${cat.id}`);
    }
    keyboard.row();
  }

  keyboard.text('❌ Annuler', 'cancel_flow');

  await ctx.reply(
    '📸 *Nouveau Visuel*\n\n' +
    '*Étape 1/4* - Choisis la catégorie de ton produit :',
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    }
  );
}

/**
 * Show background selection
 */
async function showBackgroundSelection(ctx: BotContext): Promise<void> {
  const keyboard = new InlineKeyboard();

  for (const bg of BACKGROUNDS) {
    keyboard.text(bg.label, `background_${bg.id}`).row();
  }

  keyboard.text('🔙 Retour', 'back_to_category');
  keyboard.text('❌ Annuler', 'cancel_flow');

  await ctx.reply(
    '🎨 *Nouveau Visuel*\n\n' +
    '*Étape 2/4* - Choisis le style de fond :',
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    }
  );
}

/**
 * Show template selection
 */
async function showTemplateSelection(ctx: BotContext): Promise<void> {
  const keyboard = new InlineKeyboard();

  for (const tpl of TEMPLATES) {
    keyboard.text(tpl.label, `template_${tpl.id}`);
  }
  keyboard.row();

  keyboard.text('🔙 Retour', 'back_to_background');
  keyboard.text('❌ Annuler', 'cancel_flow');

  await ctx.reply(
    '📐 *Nouveau Visuel*\n\n' +
    '*Étape 3/4* - Choisis le template :\n\n' +
    '• *Template A* : Produit centré, prix en bas\n' +
    '• *Template B* : Produit en haut, infos centrées\n' +
    '• *Template C* : Style moderne asymétrique',
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    }
  );
}

/**
 * Show mannequin selection
 */
async function showMannequinSelection(ctx: BotContext): Promise<void> {
  const keyboard = new InlineKeyboard();

  for (const man of MANNEQUINS) {
    keyboard.text(man.label, `mannequin_${man.id}`).row();
  }

  keyboard.text('🔙 Retour', 'back_to_template');
  keyboard.text('❌ Annuler', 'cancel_flow');

  await ctx.reply(
    '👕 *Nouveau Visuel*\n\n' +
    '*Étape 4/4* - Mode mannequin :\n\n' +
    '• *Aucun* : Photo du produit seul\n' +
    '• *Mannequin Fantôme* : Effet 3D invisible\n' +
    '• *Modèle Virtuel* : IA génère un modèle',
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    }
  );
}

/**
 * Show photo upload prompt
 */
async function showPhotoPrompt(ctx: BotContext): Promise<void> {
  await ctx.reply(
    '📷 *Parfait !*\n\n' +
    'Maintenant, envoie-moi la photo de ton produit.\n\n' +
    '_Conseils :_\n' +
    '• Bonne luminosité\n' +
    '• Fond neutre si possible\n' +
    '• Produit bien visible\n\n' +
    '👇 *Envoie ta photo maintenant*',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [[{ text: '❌ Annuler' }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }
  );

  ctx.session.flowStep = 'photo';
}

/**
 * Handle visual flow callbacks
 */
export async function handleVisualCallback(ctx: BotContext): Promise<void> {
  const action = ctx.callbackQuery?.data;
  if (!action) return;

  // Handle cancel
  if (action === 'cancel_flow') {
    ctx.session.currentFlow = undefined;
    ctx.session.flowStep = undefined;
    ctx.session.jobOptions = {};
    await ctx.answerCallbackQuery({ text: 'Annulé' });
    await ctx.reply('❌ Création annulée. Tape /menu pour revenir au menu.');
    return;
  }

  // Handle back buttons
  if (action === 'back_to_category') {
    ctx.session.flowStep = 'category';
    await ctx.answerCallbackQuery();
    await showCategorySelection(ctx);
    return;
  }

  if (action === 'back_to_background') {
    ctx.session.flowStep = 'background';
    await ctx.answerCallbackQuery();
    await showBackgroundSelection(ctx);
    return;
  }

  if (action === 'back_to_template') {
    ctx.session.flowStep = 'template';
    await ctx.answerCallbackQuery();
    await showTemplateSelection(ctx);
    return;
  }

  // Handle category selection
  if (action.startsWith('category_')) {
    const category = action.replace('category_', '');
    ctx.session.jobOptions.category = category;
    ctx.session.flowStep = 'background';
    await ctx.answerCallbackQuery({ text: `✅ ${category}` });
    await showBackgroundSelection(ctx);
    return;
  }

  // Handle background selection
  if (action.startsWith('background_')) {
    const background = action.replace('background_', '');
    ctx.session.jobOptions.backgroundStyle = background;
    ctx.session.flowStep = 'template';
    await ctx.answerCallbackQuery({ text: '✅ Fond sélectionné' });
    await showTemplateSelection(ctx);
    return;
  }

  // Handle template selection
  if (action.startsWith('template_')) {
    const template = action.replace('template_', '');
    ctx.session.jobOptions.templateLayout = template;
    ctx.session.flowStep = 'mannequin';
    await ctx.answerCallbackQuery({ text: `✅ Template ${template}` });
    await showMannequinSelection(ctx);
    return;
  }

  // Handle mannequin selection
  if (action.startsWith('mannequin_')) {
    const mannequin = action.replace('mannequin_', '');
    ctx.session.jobOptions.mannequinMode = mannequin;
    await ctx.answerCallbackQuery({ text: '✅ Mode sélectionné' });
    await showPhotoPrompt(ctx);
    return;
  }
}

/**
 * Handle photo upload
 */
export async function handlePhotoUpload(ctx: BotContext): Promise<void> {
  if (ctx.session.currentFlow !== 'new_visual' || ctx.session.flowStep !== 'photo') {
    return;
  }

  const photo = ctx.message?.photo;
  if (!photo || photo.length === 0) {
    await ctx.reply('❌ Je n\'ai pas reçu de photo. Réessaie.');
    return;
  }

  // Get largest photo
  const largestPhoto = photo[photo.length - 1];
  const messageId = ctx.message?.message_id?.toString() || Date.now().toString();

  await ctx.reply('⏳ *Traitement en cours...*\n\nJe prépare ton visuel, ça prend quelques secondes.', {
    parse_mode: 'Markdown',
  });

  try {
    // Get file from Telegram
    const file = await ctx.api.getFile(largestPhoto.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;

    // Download and upload to R2
    const r2Key = await uploadPhotoToR2(
      ctx.session.profileId || 'unknown',
      messageId,
      fileUrl
    );

    if (!r2Key) {
      throw new Error('Failed to upload to R2');
    }

    // Create job via API
    // idempotency_key = telegram:<message_id>
    const result = await createJob(ctx.session.profileId || '', {
      sourceMessageId: messageId,
      category: ctx.session.jobOptions.category || 'clothing',
      backgroundStyle: ctx.session.jobOptions.backgroundStyle || 'studio_clean_white',
      templateLayout: ctx.session.jobOptions.templateLayout || 'A',
      mannequinMode: ctx.session.jobOptions.mannequinMode || 'none',
    });

    if (result.error) {
      if (result.errorCode === 'CREDITS_INSUFFICIENT') {
        await ctx.reply(
          '❌ *Crédits insuffisants*\n\n' +
          'Tu n\'as plus de crédits. Achète un pack pour continuer !\n\n' +
          'Tape /credits pour voir les offres.',
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.reply(`❌ Erreur: ${result.error}`);
      }
      return;
    }

    ctx.session.pendingJobId = result.jobId;

    await ctx.reply(
      '✅ *Photo reçue !*\n\n' +
      '🔄 Traitement en cours...\n' +
      `💰 Crédits restants: ${result.creditsRemaining}\n\n` +
      '_Tu recevras tes visuels dans quelques instants._',
      { parse_mode: 'Markdown' }
    );

    // Reset flow
    ctx.session.currentFlow = undefined;
    ctx.session.flowStep = undefined;

  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Photo upload error:', error);
    await ctx.reply('❌ Une erreur est survenue. Réessaie.');
  }
}

/**
 * Handle regenerate callback
 */
export async function handleRegenerateCallback(ctx: BotContext): Promise<void> {
  const action = ctx.callbackQuery?.data;
  if (!action?.startsWith('regenerate_')) return;

  // jobId will be used for actual regeneration in production
  // const jobId = action.replace('regenerate_', '');

  await ctx.answerCallbackQuery({ text: '🔄 Régénération...' });
  await ctx.reply(
    '🔄 *Régénération demandée*\n\n' +
    '⚠️ Attention : une régénération consomme 1 crédit supplémentaire.\n\n' +
    '_Fonctionnalité en cours de développement._',
    { parse_mode: 'Markdown' }
  );
}
