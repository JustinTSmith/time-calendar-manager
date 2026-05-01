import { env } from '../../config/env.js';

// OAuth scopes required for calendar sync
const SCOPES = ['Calendars.ReadWrite', 'User.Read', 'offline_access'];

// Microsoft OAuth endpoints
const AUTH_URL = `${env.MICROSOFT_AUTHORITY}/oauth2/v2.0/authorize`;
const TOKEN_URL = `${env.MICROSOFT_AUTHORITY}/oauth2/v2.0/token`;

export interface MicrosoftTokens {
  accessToken: string;
  refreshToken: string;
  expiresOn: Date;
  scope: string;
}

export interface MicrosoftUserInfo {
  id: string;
  email: string;
  displayName: string;
}

/**
 * Generate the Microsoft OAuth authorization URL
 */
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID,
    response_type: 'code',
    redirect_uri: env.MICROSOFT_REDIRECT_URI,
    scope: SCOPES.join(' '),
    state,
    prompt: 'consent', // Force consent to ensure we get a refresh token
  });

  return `${AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function handleCallback(code: string): Promise<MicrosoftTokens> {
  const params = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID,
    client_secret: env.MICROSOFT_CLIENT_SECRET,
    code,
    redirect_uri: env.MICROSOFT_REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresOn: new Date(Date.now() + data.expires_in * 1000),
    scope: data.scope,
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<MicrosoftTokens> {
  const params = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID,
    client_secret: env.MICROSOFT_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: SCOPES.join(' '),
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // Use new refresh token if provided
    expiresOn: new Date(Date.now() + data.expires_in * 1000),
    scope: data.scope,
  };
}

/**
 * Get user info from Microsoft Graph
 */
export async function getMicrosoftUserInfo(accessToken: string): Promise<MicrosoftUserInfo> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    email: data.mail || data.userPrincipalName,
    displayName: data.displayName,
  };
}

/**
 * Generate a cryptographically secure state parameter
 */
export function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
