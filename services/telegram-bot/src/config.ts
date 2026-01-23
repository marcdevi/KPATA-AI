/**
 * Configuration for KPATA AI Telegram Bot
 */

export const config = {
  // Bot token from BotFather
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  
  // API endpoint
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  
  // Redis for session storage
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // Rate limiting
  rateLimit: {
    maxCommandsPerMinute: 10,
    cooldownMinutes: 5,
  },
  
  // R2 Storage
  r2: {
    endpoint: process.env.R2_ENDPOINT || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucketRaw: process.env.R2_BUCKET_RAW || 'kpata-raw-upload',
  },
  
  // Media worker URL for result images
  mediaWorkerUrl: process.env.MEDIA_WORKER_URL || '',
};

export function validateConfig(): void {
  if (!config.botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is required');
  }
}
