import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_REDIRECT_URI: z.string(),
  JWT_SECRET: z.string(),
  ENCRYPTION_KEY: z.string().length(64, 'Encryption key must be 32 bytes (64 hex characters)'),
  WEB_URL: z.string().default('http://localhost:3000'),
  API_URL: z.string().default('http://localhost:3001'),
  GOOGLE_WEBHOOK_SECRET: z.string().optional(),
  PORT: z.string().default('3001'),
});

export const env = envSchema.parse(process.env);
