-- Add fields needed for Microsoft OAuth and webhook subscriptions
ALTER TABLE calendar_accounts 
ADD COLUMN IF NOT EXISTS token_expires_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS subscription_id text,
ADD COLUMN IF NOT EXISTS subscription_expires_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Create index for subscription lookups
CREATE INDEX IF NOT EXISTS calendar_accounts_subscription_id_idx ON calendar_accounts(subscription_id);

-- Create index for token expiration checks
CREATE INDEX IF NOT EXISTS calendar_accounts_token_expires_at_idx ON calendar_accounts(token_expires_at);
