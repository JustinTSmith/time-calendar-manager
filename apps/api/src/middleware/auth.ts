<<<<<<< HEAD
import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@time-calendar-manager/db';
import { users } from '@time-calendar-manager/db';
import { eq } from 'drizzle-orm';

export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      reply.status(401).send({ error: 'Unauthorized' });
      return;
    }

    const token = authHeader.slice(7);
    const decoded = await request.jwtVerify<{ userId: string }>();
    
    // Fetch user from database
    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded.userId),
    });

    if (!user) {
      reply.status(401).send({ error: 'User not found' });
      return;
    }

    (request as AuthenticatedRequest).user = {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  } catch (err) {
    reply.status(401).send({ error: 'Invalid token' });
  }
=======
import type { Request, Response, NextFunction } from 'express'

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
>>>>>>> origin/blocks/jus-29-test-scaffolding-vitest-unit-tests-and-playwright-e2e-smoke
}
