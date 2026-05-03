import { eq, and, isNull } from 'drizzle-orm';
import { hash, compare } from 'bcryptjs';
import { db, users, refreshTokens, taskLists } from '@time-calendar-manager/db';
import { generateTokenPair, hashToken, verifyRefreshToken } from '../utils/jwt.js';
import type { TokenPair } from '../utils/jwt.js';

const BCRYPT_ROUNDS = 12;

export interface AuthResult {
  user: {
    id: string;
    email: string;
    name: string;
    timezone: string;
    plan: string;
    createdAt: Date;
  };
  accessToken: string;
  refreshToken: string;
}

export interface SignupInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function signup(input: SignupInput): Promise<AuthResult> {
  const { email, password, name } = input;

  // Check if user already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existingUser) {
    throw new AuthError('Email already registered', 'EMAIL_EXISTS');
  }

  // Hash password
  const passwordHash = await hash(password, BCRYPT_ROUNDS);

  // Create user and Inbox task list in a transaction
  const result = await db.transaction(async (tx) => {
    // Create user
    const [user] = await tx
      .insert(users)
      .values({
        email,
        passwordHash,
        name,
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        timezone: users.timezone,
        plan: users.plan,
        createdAt: users.createdAt,
      });

    // Create Inbox task list
    await tx.insert(taskLists).values({
      userId: user.id,
      name: 'Inbox',
      isInbox: true,
    });

    return user;
  });

  // Generate tokens
  const tokens = await generateTokenPair(result.id, result.email);

  // Store refresh token hash
  await db.insert(refreshTokens).values({
    userId: result.id,
    tokenHash: tokens.refreshTokenHash,
    expiresAt: tokens.refreshTokenExpiresAt,
  });

  return {
    user: result,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const { email, password } = input;

  // Find user by email
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user || !user.passwordHash) {
    throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS');
  }

  // Compare password
  const isValid = await compare(password, user.passwordHash);

  if (!isValid) {
    throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS');
  }

  // Generate tokens
  const tokens = await generateTokenPair(user.id, user.email);

  // Store refresh token hash
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: tokens.refreshTokenHash,
    expiresAt: tokens.refreshTokenExpiresAt,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      timezone: user.timezone,
      plan: user.plan,
      createdAt: user.createdAt,
    },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

export async function refresh(refreshToken: string): Promise<AuthResult> {
  // Verify refresh token signature
  let payload;
  try {
    payload = await verifyRefreshToken(refreshToken);
  } catch {
    throw new AuthError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const tokenHash = hashToken(refreshToken);

  // Find the token in database and check if it's valid
  const storedToken = await db.query.refreshTokens.findFirst({
    where: and(
      eq(refreshTokens.tokenHash, tokenHash),
      isNull(refreshTokens.revokedAt)
    ),
  });

  if (!storedToken) {
    throw new AuthError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  // Check if token is expired
  if (new Date() > storedToken.expiresAt) {
    throw new AuthError('Refresh token expired', 'TOKEN_EXPIRED');
  }

  // Get user
  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.sub),
  });

  if (!user) {
    throw new AuthError('User not found', 'USER_NOT_FOUND');
  }

  // Generate new token pair
  const tokens = await generateTokenPair(user.id, user.email);

  // Rotate: revoke old token and insert new one
  await db.transaction(async (tx) => {
    // Revoke old token
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, storedToken.id));

    // Insert new token
    await tx.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: tokens.refreshTokenHash,
      expiresAt: tokens.refreshTokenExpiresAt,
    });
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      timezone: user.timezone,
      plan: user.plan,
      createdAt: user.createdAt,
    },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

export async function logout(refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);

  // Find and revoke the token
  const storedToken = await db.query.refreshTokens.findFirst({
    where: and(
      eq(refreshTokens.tokenHash, tokenHash),
      isNull(refreshTokens.revokedAt)
    ),
  });

  if (storedToken) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, storedToken.id));
  }
}
