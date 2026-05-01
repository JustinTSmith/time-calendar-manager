import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db, calendarAccounts, users } from '../lib/db.js';
import { 
  getAuthorizationUrl, 
  handleCallback, 
  getMicrosoftUserInfo,
  generateState 
} from '../services/microsoft/microsoft-auth.js';
import { storeTokens } from '../services/token-manager.js';
import { encryptToken } from '../lib/crypto.js';
import { syncQueue } from '../lib/queue.js';
import { env } from '../config/env.js';

// In-memory state store (use Redis in production)
const stateStore = new Map<string, { userId: string; createdAt: number }>();

// Cleanup old states every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of stateStore.entries()) {
    if (now - data.createdAt > 10 * 60 * 1000) { // 10 minutes
      stateStore.delete(state);
    }
  }
}, 60000);

export const authRoutes = new Hono();

/**
 * GET /api/v1/auth/microsoft
 * Initiates Microsoft OAuth flow
 */
authRoutes.get('/microsoft', async (c) => {
  // Get user ID from auth context (simplified - should come from JWT/session)
  const userId = c.req.query('userId');
  if (!userId) {
    return c.json({ error: 'User ID required' }, 400);
  }

  const state = generateState();
  stateStore.set(state, { userId, createdAt: Date.now() });

  const authUrl = getAuthorizationUrl(state);
  return c.redirect(authUrl);
});

/**
 * GET /api/v1/auth/microsoft/callback
 * Handles Microsoft OAuth callback
 */
authRoutes.get('/microsoft/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');
  const errorDescription = c.req.query('error_description');

  // Handle OAuth errors
  if (error) {
    console.error('Microsoft OAuth error:', error, errorDescription);
    return c.redirect(`${env.PUBLIC_URL}/auth/error?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return c.redirect(`${env.PUBLIC_URL}/auth/error?error=missing_params`);
  }

  // Validate state
  const stateData = stateStore.get(state);
  if (!stateData) {
    return c.redirect(`${env.PUBLIC_URL}/auth/error?error=invalid_state`);
  }
  stateStore.delete(state);

  try {
    // Exchange code for tokens
    const tokens = await handleCallback(code);

    // Get user info from Microsoft
    const userInfo = await getMicrosoftUserInfo(tokens.accessToken);

    // Check if account already exists
    const existingAccount = await db.query.calendarAccounts.findFirst({
      where: eq(calendarAccounts.userId, stateData.userId),
    });

    let accountId: string;

    if (existingAccount) {
      // Update existing account
      await storeTokens(existingAccount.id, tokens.accessToken, tokens.refreshToken, tokens.expiresOn);
      accountId = existingAccount.id;
    } else {
      // Create new calendar account
      const encryptedAccessToken = encryptToken(tokens.accessToken);
      const encryptedRefreshToken = encryptToken(tokens.refreshToken);

      const [newAccount] = await db.insert(calendarAccounts).values({
        userId: stateData.userId,
        provider: 'microsoft',
        accessTokenEncrypted: encryptedAccessToken,
        refreshTokenEncrypted: encryptedRefreshToken,
        tokenExpiresAt: tokens.expiresOn,
        status: 'active',
      }).returning({ id: calendarAccounts.id });

      accountId = newAccount.id;
    }

    // Trigger full sync job
    await syncQueue.add('microsoft-full-sync', {
      accountId,
      userId: stateData.userId,
    }, {
      jobId: `full-sync-${accountId}`,
    });

    // Redirect to success page
    return c.redirect(`${env.PUBLIC_URL}/auth/success?provider=microsoft`);
  } catch (err) {
    console.error('Microsoft OAuth callback error:', err);
    return c.redirect(`${env.PUBLIC_URL}/auth/error?error=auth_failed`);
  }
});

/**
 * POST /api/v1/auth/microsoft/disconnect
 * Disconnect Microsoft account
 */
authRoutes.post('/microsoft/disconnect', async (c) => {
  const userId = c.req.query('userId');
  if (!userId) {
    return c.json({ error: 'User ID required' }, 400);
  }

  try {
    // Find and delete Microsoft account
    const account = await db.query.calendarAccounts.findFirst({
      where: eq(calendarAccounts.userId, userId),
    });

    if (!account) {
      return c.json({ error: 'Account not found' }, 404);
    }

    // TODO: Revoke tokens with Microsoft if needed
    // await revokeMicrosoftTokens(account.id);

    // Delete account (cascades to calendars and events)
    await db.delete(calendarAccounts).where(eq(calendarAccounts.id, account.id));

    return c.json({ success: true });
  } catch (err) {
    console.error('Disconnect error:', err);
    return c.json({ error: 'Failed to disconnect account' }, 500);
  }
});
