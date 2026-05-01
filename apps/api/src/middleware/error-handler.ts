import type { FastifyInstance, FastifyError } from 'fastify';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function registerErrorHandler(fastify: FastifyInstance) {
  fastify.setErrorHandler((error: FastifyError | AppError | Error, request, reply) => {
    // Zod validation errors
    if (error instanceof ZodError) {
      return reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        }
      });
    }

    // AppError (custom application errors)
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        }
      });
    }

    // Fastify errors (e.g., validation errors)
    if ('statusCode' in error && error.statusCode === 400) {
      return reply.status(400).send({
        error: {
          code: 'BAD_REQUEST',
          message: error.message,
        }
      });
    }

    // Unknown errors (log and return 500)
    request.log.error(error);
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      }
    });
  });
}
