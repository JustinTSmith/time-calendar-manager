import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { Server } from 'socket.io';

import { registerAuthMiddleware } from './middleware/auth.js';
import { registerErrorHandler } from './middleware/error-handler.js';
import { healthRoutes } from './routes/health.js';
import { setupSocketAuth } from './socket/index.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';

async function main() {
  const fastify = Fastify({
    logger: true,
  });

  // CORS
  await fastify.register(cors, {
    origin: WEB_URL,
    credentials: true,
  });

  // Rate Limiting
  await fastify.register(rateLimit, {
    max: async (req) => {
      // 100 req/min for GET, 30 req/min for write methods
      return req.method === 'GET' ? 100 : 30;
    },
    timeWindow: '1 minute',
  });

  // Error Handler
  registerErrorHandler(fastify);

  // Auth Middleware
  registerAuthMiddleware(fastify);

  // Routes
  await fastify.register(healthRoutes);

  // Socket.io
  const io = new Server(fastify.server, {
    cors: { origin: WEB_URL },
  });
  setupSocketAuth(io);

  await fastify.ready();
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`API server running on port ${PORT}`);
}

main().catch(console.error);
