import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_REDIRECT_URI: z.string(),
  GOOGLE_WEBHOOK_SECRET: z.string().optional(),

  // Microsoft OAuth
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_REDIRECT_URI: z.string().default('http://localhost:3001/api/v1/auth/microsoft/callback'),
  MICROSOFT_AUTHORITY: z.string().default('https://login.microsoftonline.com/common'),
  MICROSOFT_WEBHOOK_SECRET: z.string().optional(),

  // JWT
  JWT_SECRET: z.string(),
  JWT_ACCESS_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),

  // Encryption (32 bytes = 64 hex chars)
  ENCRYPTION_KEY: z.string().length(64, 'Encryption key must be 32 bytes (64 hex characters)'),

  // Server
  PORT: z.string().default('3001'),
  WEB_URL: z.string().default('http://localhost:3000'),
  API_URL: z.string().default('http://localhost:3001'),
});

export const env = envSchema.parse(process.env);
