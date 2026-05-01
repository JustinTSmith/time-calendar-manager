import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { signup, login, refresh, logout, AuthError } from '../services/auth.service.js';

const app = new Hono();

// Validation schemas
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Helper to format user response
function formatUser(user: {
  id: string;
  email: string;
  name: string;
  timezone: string;
  plan: string;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    timezone: user.timezone,
    plan: user.plan,
    createdAt: user.createdAt.toISOString(),
  };
}

// POST /api/v1/auth/signup
app.post('/signup', zValidator('json', signupSchema), async (c) => {
  try {
    const body = c.req.valid('json');
    const result = await signup(body);

    return c.json({
      data: {
        user: formatUser(result.user),
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    }, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.code === 'EMAIL_EXISTS') {
        return c.json({ error: 'Email already registered' }, 409);
      }
    }
    throw error;
  }
});

// POST /api/v1/auth/login
app.post('/login', zValidator('json', loginSchema), async (c) => {
  try {
    const body = c.req.valid('json');
    const result = await login(body);

    return c.json({
      data: {
        user: formatUser(result.user),
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Return 401 without specifying which field is wrong
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    throw error;
  }
});

// POST /api/v1/auth/refresh
app.post('/refresh', zValidator('json', refreshSchema), async (c) => {
  try {
    const body = c.req.valid('json');
    const result = await refresh(body.refreshToken);

    return c.json({
      data: {
        user: formatUser(result.user),
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: 'Invalid refresh token' }, 401);
    }
    throw error;
  }
});

// DELETE /api/v1/auth/session
app.delete('/session', zValidator('json', logoutSchema), async (c) => {
  const body = c.req.valid('json');
  await logout(body.refreshToken);

  return c.json({ data: { success: true } });
});

export default app;
