/**
 * Idempotency Key Generation for KPATA AI
 * Ensures unique job identification across channels
 */

import { SourceChannel } from '@kpata/shared';

/**
 * Generate idempotency key for job creation
 * 
 * Format:
 * - Bot (telegram/whatsapp): {channel}:{message_id}
 * - App: {channel}:{client_request_id}
 * 
 * @param channel - Source channel (telegram_bot, whatsapp_bot, mobile_app, etc.)
 * @param messageId - Message ID from bot platform (for bot channels)
 * @param clientRequestId - Client-generated request ID (for app channels)
 * @returns Idempotency key string
 */
export function generateIdempotencyKey(
  channel: SourceChannel,
  messageId?: string,
  clientRequestId?: string
): string {
  const channelStr = channel.toString();

  // Bot channels use message_id
  if (channel === SourceChannel.TELEGRAM_BOT || channel === SourceChannel.WHATSAPP_BOT) {
    if (!messageId) {
      throw new Error(`Message ID required for ${channel} channel`);
    }
    return `${channelStr}:${messageId}`;
  }

  // App channels use client_request_id
  if (!clientRequestId) {
    throw new Error(`Client request ID required for ${channel} channel`);
  }
  return `${channelStr}:${clientRequestId}`;
}

/**
 * Parse idempotency key back to components
 */
export function parseIdempotencyKey(key: string): { channel: string; id: string } {
  const colonIndex = key.indexOf(':');
  if (colonIndex === -1) {
    throw new Error('Invalid idempotency key format');
  }
  return {
    channel: key.slice(0, colonIndex),
    id: key.slice(colonIndex + 1),
  };
}

/**
 * Validate idempotency key format
 */
export function isValidIdempotencyKey(key: string): boolean {
  if (!key || key.length < 3) return false;
  const colonIndex = key.indexOf(':');
  return colonIndex > 0 && colonIndex < key.length - 1;
}
