import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/time_calendar_manager'),
  
  // Server
  PORT: z.string().default('3000'),
  PUBLIC_URL: z.string().default('http://localhost:3000'),
  
  // Microsoft OAuth
  MICROSOFT_CLIENT_ID: z.string(),
  MICROSOFT_CLIENT_SECRET: z.string(),
  MICROSOFT_REDIRECT_URI: z.string().default('http://localhost:3000/api/v1/auth/microsoft/callback'),
  MICROSOFT_AUTHORITY: z.string().default('https://login.microsoftonline.com/common'),
  
  // Encryption
  ENCRYPTION_KEY: z.string().min(32, 'Encryption key must be at least 32 characters'),
  
  // Redis (BullMQ)
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // Webhook
  WEBHOOK_SECRET: z.string(),
});

export const env = envSchema.parse(process.env);
