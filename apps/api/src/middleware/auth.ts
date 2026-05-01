import jwt from 'jsonwebtoken';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';

export interface UserPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

// Extend FastifyRequest type
declare module 'fastify' {
  interface FastifyRequest {
    user?: UserPayload;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required' }
    });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    request.user = decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return reply.status(401).send({
        error: { code: 'AUTH_EXPIRED', message: 'Token has expired' }
      });
    }
    return reply.status(401).send({
      error: { code: 'AUTH_REQUIRED', message: 'Invalid token' }
    });
  }
}

export function registerAuthMiddleware(fastify: FastifyInstance) {
  fastify.decorate('authenticate', authenticate);
}

// Extend FastifyInstance to include authenticate method
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
