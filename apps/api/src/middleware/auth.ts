import type { Context, Next } from 'hono';

// TODO: replace with real JWT auth
const DEV_USER_ID = '00000000-0000-0000-0000-000000000000';

export async function authMiddleware(c: Context, next: Next) {
  const userId = c.req.header('X-User-Id') ?? DEV_USER_ID;
  c.set('userId', userId);
  await next();
}
