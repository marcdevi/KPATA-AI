/**
 * Notification for KPATA AI Worker
 * Send notifications on job completion or failure
 */

// Supabase client will be used in production for storing notifications
// import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface NotificationPayload {
  profileId: string;
  jobId: string;
  type: 'job_completed' | 'job_failed';
  message: string;
  sourceChannel: string;
  correlationId: string;
}

/**
 * DLQ failure message - sent only after final attempt (attempt=3)
 */
export const DLQ_FAILURE_MESSAGES = {
  fr: "Désolé, le réseau est compliqué. Ton crédit a été remboursé. 🙏",
  en: "Sorry, the network is having issues. Your credit has been refunded. 🙏",
} as const;

/**
 * Success message
 */
export const SUCCESS_MESSAGES = {
  fr: "✨ Ta photo est prête ! Clique pour voir le résultat.",
  en: "✨ Your photo is ready! Click to see the result.",
} as const;

/**
 * Send notification to user on job failure (DLQ)
 * Only called after all retries exhausted (attempt=3)
 */
export async function notifyJobFailed(
  payload: Omit<NotificationPayload, 'type' | 'message'>,
  language = 'fr'
): Promise<void> {
  const message = DLQ_FAILURE_MESSAGES[language as keyof typeof DLQ_FAILURE_MESSAGES] || DLQ_FAILURE_MESSAGES.fr;

  await sendNotification({
    ...payload,
    type: 'job_failed',
    message,
  });
}

/**
 * Send notification to user on job completion
 */
export async function notifyJobCompleted(
  payload: Omit<NotificationPayload, 'type' | 'message'>,
  language = 'fr'
): Promise<void> {
  const message = SUCCESS_MESSAGES[language as keyof typeof SUCCESS_MESSAGES] || SUCCESS_MESSAGES.fr;

  await sendNotification({
    ...payload,
    type: 'job_completed',
    message,
  });
}

/**
 * Send notification based on source channel
 */
async function sendNotification(payload: NotificationPayload): Promise<void> {
  const { profileId, jobId, type, message, sourceChannel, correlationId } = payload;

  // eslint-disable-next-line no-console
  console.log(`[${correlationId}] Sending ${type} notification to ${profileId} via ${sourceChannel}`);

  // Route to appropriate channel
  switch (sourceChannel) {
    case 'telegram_bot':
      await sendTelegramNotification(profileId, message, correlationId);
      break;
    case 'whatsapp_bot':
      await sendWhatsAppNotification(profileId, message, correlationId);
      break;
    case 'mobile_app':
    case 'web_app':
      await sendPushNotification(profileId, jobId, type, message, correlationId);
      break;
    default:
      // Store in database for polling
      await storeNotification(profileId, jobId, type, message, correlationId);
  }
}

/**
 * Send Telegram notification
 * TODO: Implement actual Telegram bot API call
 */
async function sendTelegramNotification(
  profileId: string,
  message: string,
  correlationId: string
): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[${correlationId}] TODO: Send Telegram message to ${profileId}: ${message}`);
  
  // In production:
  // const telegramChatId = await getTelegramChatId(profileId);
  // await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
  //   method: 'POST',
  //   body: JSON.stringify({ chat_id: telegramChatId, text: message }),
  // });
}

/**
 * Send WhatsApp notification
 * TODO: Implement actual WhatsApp Business API call
 */
async function sendWhatsAppNotification(
  profileId: string,
  message: string,
  correlationId: string
): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[${correlationId}] TODO: Send WhatsApp message to ${profileId}: ${message}`);
  
  // In production:
  // const phoneNumber = await getPhoneNumber(profileId);
  // await whatsappClient.sendMessage(phoneNumber, message);
}

/**
 * Send push notification to mobile/web app
 * TODO: Implement actual push notification
 */
async function sendPushNotification(
  profileId: string,
  jobId: string,
  type: string,
  message: string,
  correlationId: string
): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[${correlationId}] TODO: Send push notification to ${profileId}: ${message}`);
  
  // Store notification for app to poll
  await storeNotification(profileId, jobId, type as 'job_completed' | 'job_failed', message, correlationId);
}

/**
 * Store notification in database for polling
 */
async function storeNotification(
  profileId: string,
  _jobId: string,
  type: 'job_completed' | 'job_failed',
  message: string,
  correlationId: string
): Promise<void> {
  // For MVP, we'll just log. In production, store in notifications table
  // eslint-disable-next-line no-console
  console.log(`[${correlationId}] Storing notification for ${profileId}: ${type} - ${message}`);

  // In production:
  // await supabase.from('notifications').insert({
  //   profile_id: profileId,
  //   job_id: jobId,
  //   type,
  //   message,
  //   read: false,
  // });
}
