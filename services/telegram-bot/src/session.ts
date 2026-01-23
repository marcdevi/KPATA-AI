/**
 * Session Storage for KPATA AI Telegram Bot
 * Uses Redis for persistent session storage
 */

import { Redis } from 'ioredis';

import { config } from './config.js';
import { SessionData, createInitialSession } from './types.js';

let redisClient: Redis | null = null;

const SESSION_PREFIX = 'tg_session:';
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

/**
 * Get Redis client (singleton)
 */
function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
    });
  }
  return redisClient;
}

/**
 * Get session key for a chat
 */
function getSessionKey(chatId: number): string {
  return `${SESSION_PREFIX}${chatId}`;
}

/**
 * Load session from Redis
 */
export async function loadSession(chatId: number): Promise<SessionData> {
  const redis = getRedis();
  const key = getSessionKey(chatId);
  
  const data = await redis.get(key);
  if (!data) {
    return createInitialSession();
  }
  
  try {
    return JSON.parse(data) as SessionData;
  } catch {
    return createInitialSession();
  }
}

/**
 * Save session to Redis
 */
export async function saveSession(chatId: number, session: SessionData): Promise<void> {
  const redis = getRedis();
  const key = getSessionKey(chatId);
  
  await redis.setex(key, SESSION_TTL, JSON.stringify(session));
}

/**
 * Delete session from Redis
 */
export async function deleteSession(chatId: number): Promise<void> {
  const redis = getRedis();
  const key = getSessionKey(chatId);
  
  await redis.del(key);
}

/**
 * Close Redis connection
 */
export async function closeSession(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
