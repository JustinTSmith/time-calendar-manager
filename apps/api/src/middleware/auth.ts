import { createMiddleware } from 'hono/factory';
import { jwtVerify } from 'jose';
import { ApiError } from '../lib/errors.js';

type AuthVariables = {
  userId: string;
};

const getSecret = () => {
  const secret = process.env['JWT_SECRET'];
  if (!secret) throw new Error('JWT_SECRET environment variable is required');
  return new TextEncoder().encode(secret);
};

export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiError(401, 'UNAUTHORIZED');
  }

  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    const sub = payload.sub;
    if (!sub) throw new ApiError(401, 'UNAUTHORIZED', 'Token missing sub claim');
    c.set('userId', sub);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(401, 'UNAUTHORIZED');
  }

  await next();
});
