/**
 * KPATA AI Telegram Bot
 * Main entry point
 */

import { Bot, session } from 'grammy';

import { config, validateConfig } from './config.js';
import {
  handleStart,
  handleContact,
  handlePhoneText,
  handleTermsCallback,
  showMainMenu,
  handleMenuCallback,
  startNewVisualFlow,
  handleVisualCallback,
  handlePhotoUpload,
  handleRegenerateCallback,
} from './handlers/index.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { loadSession, saveSession, closeSession } from './session.js';
import { BotContext, createInitialSession } from './types.js';

// Validate configuration
validateConfig();

// Create bot instance
const bot = new Bot<BotContext>(config.botToken);

// Session middleware with Redis storage
bot.use(session({
  initial: createInitialSession,
  getSessionKey: (ctx) => ctx.chat?.id.toString() || '',
  storage: {
    read: async (key) => {
      const chatId = parseInt(key, 10);
      if (isNaN(chatId)) return createInitialSession();
      return loadSession(chatId);
    },
    write: async (key, value) => {
      const chatId = parseInt(key, 10);
      if (!isNaN(chatId)) {
        await saveSession(chatId, value);
      }
    },
    delete: async (key) => {
      const chatId = parseInt(key, 10);
      if (!isNaN(chatId)) {
        await saveSession(chatId, createInitialSession());
      }
    },
  },
}));

// Rate limit middleware
bot.use(rateLimitMiddleware);

// Auth middleware (blocks users without CGU)
bot.use(authMiddleware);

// Command handlers
bot.command('start', handleStart);
bot.command('menu', async (ctx) => {
  if (ctx.session.hasAcceptedTerms) {
    await showMainMenu(ctx);
  } else {
    await ctx.reply('Tu dois d\'abord accepter les CGU. Tape /start');
  }
});

bot.command('credits', async (ctx) => {
  // Trigger credits menu callback
  ctx.callbackQuery = { data: 'my_credits' } as any;
  await handleMenuCallback(ctx);
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    '📚 *Aide KPATA AI*\n\n' +
    '*Commandes disponibles :*\n' +
    '/start - Démarrer / S\'inscrire\n' +
    '/menu - Menu principal\n' +
    '/credits - Voir mes crédits\n' +
    '/help - Cette aide\n\n' +
    '*Comment ça marche ?*\n' +
    '1. Choisis ta catégorie et ton style\n' +
    '2. Envoie ta photo de produit\n' +
    '3. Reçois tes visuels pro en quelques secondes !\n\n' +
    '💬 Support: support@kpata.ai',
    { parse_mode: 'Markdown' }
  );
});

// Contact handler (phone sharing)
bot.on('message:contact', handleContact);

// Photo handler
bot.on('message:photo', handlePhotoUpload);

// Text message handler
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;

  // Handle cancel
  if (text === '❌ Annuler') {
    ctx.session.currentFlow = undefined;
    ctx.session.flowStep = undefined;
    ctx.session.jobOptions = {};
    await ctx.reply('❌ Annulé.', {
      reply_markup: { remove_keyboard: true },
    });
    await showMainMenu(ctx);
    return;
  }

  // Handle phone input
  if (ctx.session.awaitingPhone) {
    await handlePhoneText(ctx);
    return;
  }

  // Default response
  if (ctx.session.hasAcceptedTerms) {
    await ctx.reply('Je n\'ai pas compris. Tape /menu pour voir les options.');
  }
});

// Callback query handlers
bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;

  // Terms callbacks
  if (data === 'accept_terms' || data === 'decline_terms') {
    await handleTermsCallback(ctx);
    return;
  }

  // Menu callbacks
  if (data === 'new_visual') {
    await startNewVisualFlow(ctx);
    return;
  }

  if (data === 'my_gallery' || data === 'my_credits' || data === 'support') {
    await handleMenuCallback(ctx);
    return;
  }

  if (data === 'back_to_menu') {
    await ctx.answerCallbackQuery();
    await showMainMenu(ctx);
    return;
  }

  // Visual flow callbacks
  if (
    data.startsWith('category_') ||
    data.startsWith('background_') ||
    data.startsWith('template_') ||
    data.startsWith('mannequin_') ||
    data === 'cancel_flow' ||
    data.startsWith('back_to_')
  ) {
    await handleVisualCallback(ctx);
    return;
  }

  // Regenerate callback
  if (data.startsWith('regenerate_')) {
    await handleRegenerateCallback(ctx);
    return;
  }

  // Buy credits (placeholder)
  if (data === 'buy_credits') {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      '🛒 *Acheter des crédits*\n\n' +
      'Pour acheter des crédits, utilise l\'app mobile ou visite kpata.ai/credits\n\n' +
      '_Paiement mobile money bientôt disponible dans le bot !_',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  await ctx.answerCallbackQuery({ text: 'Action non reconnue' });
});

// Error handler
bot.catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Bot error:', err);
});

// Graceful shutdown
async function shutdown(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('Shutting down bot...');
  await bot.stop();
  await closeSession();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start bot
// eslint-disable-next-line no-console
console.log('Starting KPATA AI Telegram Bot...');
bot.start();
// eslint-disable-next-line no-console
console.log('Bot is running!');
