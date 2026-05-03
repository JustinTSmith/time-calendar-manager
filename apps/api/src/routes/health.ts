import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '@time-calendar-manager/db';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async () => {
    const startTime = Date.now();

    // Check database
    let dbStatus: 'ok' | 'error' = 'ok';
    try {
      await db.execute(sql`SELECT 1`);
    } catch {
      dbStatus = 'error';
    }

    // Redis placeholder (not implemented yet)
    const redisStatus: 'ok' | 'error' | 'not_configured' = 'not_configured';

    return {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      db: dbStatus,
      redis: redisStatus,
      uptime: process.uptime(),
      responseTime: Date.now() - startTime,
    };
  });
}
