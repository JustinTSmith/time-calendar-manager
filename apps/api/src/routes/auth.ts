import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { db, calendarAccounts, calendars, events, users } from '@time-calendar-manager/db';
import { eq, and } from 'drizzle-orm';
import { getAuthUrl, exchangeCode } from '../lib/google-client.js';
import { storeOAuthState, getOAuthState, deleteOAuthState } from '../lib/redis.js';
import { encrypt, serializeEncrypted } from '../lib/encryption.js';
import { env } from '../config/env.js';
import { queueFullSync } from '../lib/queue.js';

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch user info from Google');
  }
  
  return response.json() as Promise<GoogleUserInfo>;
}

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // Initiate Google OAuth flow
  fastify.get('/api/v1/auth/google', async (request, reply) => {
    // Get userId from query or header (for authenticated users connecting additional account)
    const { userId } = request.query as { userId?: string };
    
    if (!userId) {
      reply.status(400).send({ error: 'User ID required' });
      return;
    }

    const state = randomUUID();
    await storeOAuthState(state, userId);

    const authUrl = getAuthUrl(state);
    reply.redirect(authUrl);
  });

  // Google OAuth callback
  fastify.get('/api/v1/auth/google/callback', async (request, reply) => {
    const { code, state, error: oauthError } = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    if (oauthError) {
      reply.redirect(`${env.WEB_URL}/auth/callback?error=${encodeURIComponent(oauthError)}`);
      return;
    }

    if (!code || !state) {
      reply.redirect(`${env.WEB_URL}/auth/callback?error=invalid_request`);
      return;
    }

    // Validate state
    const userId = await getOAuthState(state);
    if (!userId) {
      reply.redirect(`${env.WEB_URL}/auth/callback?error=invalid_state`);
      return;
    }

    // Clean up state
    await deleteOAuthState(state);

    try {
      // Exchange code for tokens
      const tokens = await exchangeCode(code);
      
      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('Missing tokens from Google');
      }

      // Get user info from Google
      const googleUser = await getGoogleUserInfo(tokens.access_token);

      // Encrypt tokens
      const encryptedAccessToken = serializeEncrypted(encrypt(tokens.access_token));
      const encryptedRefreshToken = serializeEncrypted(encrypt(tokens.refresh_token));

      // Check if account already exists
      const existingAccount = await db.query.calendarAccounts.findFirst({
        where: and(
          eq(calendarAccounts.userId, userId),
          eq(calendarAccounts.provider, 'google'),
          eq(calendarAccounts.providerAccountId, googleUser.id)
        ),
      });

      let accountId: string;

      if (existingAccount) {
        // Update existing account with new tokens
        await db
          .update(calendarAccounts)
          .set({
            accessTokenEncrypted: encryptedAccessToken,
            refreshTokenEncrypted: encryptedRefreshToken,
            status: 'active',
          })
          .where(eq(calendarAccounts.id, existingAccount.id));
        
        accountId = existingAccount.id;
      } else {
        // Create new calendar account
        const [newAccount] = await db
          .insert(calendarAccounts)
          .values({
            userId,
            provider: 'google',
            providerAccountId: googleUser.id,
            accessTokenEncrypted: encryptedAccessToken,
            refreshTokenEncrypted: encryptedRefreshToken,
            status: 'active',
          })
          .returning();
        
        accountId = newAccount.id;
      }

      // Trigger full sync in background
      await queueFullSync(accountId, userId);

      // Redirect back to web app with success
      reply.redirect(`${env.WEB_URL}/auth/callback?success=true&account=${accountId}`);
    } catch (err) {
      console.error('OAuth callback error:', err);
      reply.redirect(`${env.WEB_URL}/auth/callback?error=auth_failed`);
    }
  });

  // Test endpoint to create a mock user (for development)
  fastify.post('/api/v1/auth/dev-login', async (request, reply) => {
    const { email, name } = request.body as { email?: string; name?: string };
    
    const userEmail = email || 'test@example.com';
    const userName = name || 'Test User';

    // Find or create user
    let user = await db.query.users.findFirst({
      where: eq(users.email, userEmail),
    });

    if (!user) {
      const [newUser] = await db
        .insert(users)
        .values({
          email: userEmail,
          name: userName,
          timezone: 'UTC',
        })
        .returning();
      user = newUser;
    }

    // Generate JWT
    const token = fastify.jwt.sign({ userId: user.id });

    reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  });
}
