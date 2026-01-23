/**
 * Result Handler for KPATA AI Telegram Bot
 * Send completed job results to users
 */

import { InlineKeyboard } from 'grammy';

import { config } from '../config.js';
import { BotContext } from '../types.js';

/**
 * Send job result to user
 * Called when job status becomes 'delivered'
 */
export async function sendJobResult(
  ctx: BotContext,
  jobId: string,
  profileId: string
): Promise<void> {
  // Build media URLs from media worker
  const baseUrl = config.mediaWorkerUrl;
  const whatsappUrl = `${baseUrl}/gallery/${profileId}/${jobId}/v1/whatsapp.webp`;
  const instagramUrl = `${baseUrl}/gallery/${profileId}/${jobId}/v1/instagram.webp`;

  const keyboard = new InlineKeyboard()
    .text('🔄 Régénérer (1 crédit)', `regenerate_${jobId}`)
    .row()
    .text('💬 Support', 'support')
    .text('📸 Nouveau', 'new_visual');

  try {
    // Send WhatsApp format (9:16)
    await ctx.reply('📱 *Format WhatsApp Status (9:16)*', { parse_mode: 'Markdown' });
    await ctx.replyWithPhoto(whatsappUrl);

    // Send Instagram format (1:1)
    await ctx.reply('📷 *Format Instagram (1:1)*', { parse_mode: 'Markdown' });
    await ctx.replyWithPhoto(instagramUrl);

    // Success message with actions
    await ctx.reply(
      '✅ *Tes visuels sont prêts !*\n\n' +
      '👆 Télécharge-les en cliquant sur les images.\n\n' +
      '_Satisfait ? Partage sur les réseaux !_\n' +
      '_Un problème ? Contacte le support._',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error sending result:', error);

    // Fallback: send URLs as text
    await ctx.reply(
      '✅ *Tes visuels sont prêts !*\n\n' +
      '📱 WhatsApp: ' + whatsappUrl + '\n' +
      '📷 Instagram: ' + instagramUrl + '\n\n' +
      '_Clique sur les liens pour télécharger._',
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }
    );
  }
}

/**
 * Send job failure notification
 * Called when job fails after all retries (DLQ)
 */
export async function sendJobFailure(
  ctx: BotContext,
  _jobId: string
): Promise<void> {
  const keyboard = new InlineKeyboard()
    .text('📸 Réessayer', 'new_visual')
    .row()
    .text('💬 Support', 'support');

  await ctx.reply(
    '😔 *Désolé, le réseau est compliqué.*\n\n' +
    'Ton crédit a été remboursé. 🙏\n\n' +
    '_Tu peux réessayer ou contacter le support si le problème persiste._',
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    }
  );
}
