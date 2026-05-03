-- Add columns to calendar_accounts table
ALTER TABLE "calendar_accounts" ADD COLUMN IF NOT EXISTS "provider_account_id" text;
ALTER TABLE "calendar_accounts" ADD COLUMN IF NOT EXISTS "last_sync_at" timestamp with time zone;

-- Add columns to calendars table for webhook channel management
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "channel_id" text;
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "channel_expiration" timestamp with time zone;
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "resource_id" text;
