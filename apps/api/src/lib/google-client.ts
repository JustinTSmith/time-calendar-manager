import { google, calendar_v3, Auth } from 'googleapis';
import { env } from '../config/env.js';
import { decrypt, deserializeEncrypted } from './encryption.js';

const oauth2Client: Auth.OAuth2Client = new google.auth.OAuth2(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI
);

export function getAuthUrl(state: string): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    prompt: 'consent',
    state,
  });
}

export async function exchangeCode(code: string): Promise<Auth.Credentials> {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiryDate?: number | null;
}

export function createCalendarClient(accessToken: string, refreshToken?: string): calendar_v3.Calendar {
  const auth = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
  
  auth.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  
  return google.calendar({ version: 'v3', auth });
}

export function createCalendarClientFromEncrypted(
  accessTokenEncrypted: string,
  refreshTokenEncrypted: string
): calendar_v3.Calendar {
  const accessToken = decrypt(deserializeEncrypted(accessTokenEncrypted));
  const refreshToken = decrypt(deserializeEncrypted(refreshTokenEncrypted));
  
  return createCalendarClient(accessToken, refreshToken);
}

export { oauth2Client };
