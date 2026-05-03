import { Redis } from 'ioredis';
import { env } from '../config/env.js';

export const redis = new Redis(env.REDIS_URL);

export const STATE_TTL_SECONDS = 600; // 10 minutes

export async function storeOAuthState(state: string, userId: string): Promise<void> {
  await redis.setex(`oauth:state:${state}`, STATE_TTL_SECONDS, userId);
}

export async function getOAuthState(state: string): Promise<string | null> {
  return redis.get(`oauth:state:${state}`);
}

export async function deleteOAuthState(state: string): Promise<void> {
  await redis.del(`oauth:state:${state}`);
}

// Channel storage for webhook renewals
export async function storeChannelExpiration(
  calendarId: string,
  channelId: string,
  expiration: number
): Promise<void> {
  await redis.setex(
    `channel:${calendarId}`,
    86400 * 8, // 8 days TTL
    JSON.stringify({ channelId, expiration })
  );
}

export async function getChannelExpiration(
  calendarId: string
): Promise<{ channelId: string; expiration: number } | null> {
  const data = await redis.get(`channel:${calendarId}`);
  return data ? JSON.parse(data) : null;
}
