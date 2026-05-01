import { eq } from 'drizzle-orm';
import { db, calendarAccounts } from '../lib/db.js';
import { decryptToken, encryptToken } from '../lib/crypto.js';
import { refreshAccessToken } from './microsoft/microsoft-auth.js';

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresOn: Date;
}

/**
 * Get a valid access token for a calendar account.
 * If the token is expired or about to expire, refresh it.
 */
export async function getValidAccessToken(accountId: string): Promise<string> {
  const account = await db.query.calendarAccounts.findFirst({
    where: eq(calendarAccounts.id, accountId),
  });

  if (!account) {
    throw new Error(`Calendar account not found: ${accountId}`);
  }

  if (account.status === 'invalid') {
    throw new Error(`Calendar account is invalid: ${accountId}`);
  }

  // Decrypt stored tokens
  const refreshToken = decryptToken(account.refreshTokenEncrypted);
  
  // Check if we need to refresh (expire 5 minutes early to avoid race conditions)
  const shouldRefresh = !account.tokenExpiresAt || 
    new Date(account.tokenExpiresAt).getTime() - 5 * 60 * 1000 < Date.now();

  if (shouldRefresh) {
    return refreshAndStoreToken(accountId, refreshToken);
  }

  // Token is still valid, decrypt and return
  return decryptToken(account.accessTokenEncrypted);
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAndStoreToken(accountId: string, refreshToken: string): Promise<string> {
  try {
    const tokens = await refreshAccessToken(refreshToken);

    // Encrypt new tokens
    const encryptedAccessToken = encryptToken(tokens.accessToken);
    const encryptedRefreshToken = encryptToken(tokens.refreshToken);

    // Update database
    await db.update(calendarAccounts)
      .set({
        accessTokenEncrypted: encryptedAccessToken,
        refreshTokenEncrypted: encryptedRefreshToken,
        tokenExpiresAt: tokens.expiresOn,
        updatedAt: new Date(),
      })
      .where(eq(calendarAccounts.id, accountId));

    return tokens.accessToken;
  } catch (error) {
    // Mark account as invalid if refresh fails
    await db.update(calendarAccounts)
      .set({
        status: 'invalid',
        updatedAt: new Date(),
      })
      .where(eq(calendarAccounts.id, accountId));
    
    throw new Error(`Failed to refresh token for account ${accountId}: ${error}`);
  }
}

/**
 * Store new tokens after OAuth callback
 */
export async function storeTokens(
  accountId: string, 
  accessToken: string, 
  refreshToken: string,
  expiresOn: Date
): Promise<void> {
  const encryptedAccessToken = encryptToken(accessToken);
  const encryptedRefreshToken = encryptToken(refreshToken);

  await db.update(calendarAccounts)
    .set({
      accessTokenEncrypted: encryptedAccessToken,
      refreshTokenEncrypted: encryptedRefreshToken,
      tokenExpiresAt: expiresOn,
      status: 'active',
      updatedAt: new Date(),
    })
    .where(eq(calendarAccounts.id, accountId));
}
