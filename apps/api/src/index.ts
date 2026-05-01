import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { env } from './config/env.js';
import { initializeSocket } from './lib/socket.js';
import { authRoutes } from './routes/auth.js';
import { eventsRoutes } from './routes/events.js';
import { calendarsRoutes } from './routes/calendars.js';
import { webhookRoutes } from './routes/webhooks.js';

const app = Fastify({
  logger: true,
});

// Register plugins
await app.register(cors, {
  origin: env.WEB_URL,
  credentials: true,
});

await app.register(jwt, {
  secret: env.JWT_SECRET,
});

// Health check endpoint
app.get('/health', async () => ({ status: 'ok' }));

// Register routes
await app.register(authRoutes);
await app.register(eventsRoutes);
await app.register(calendarsRoutes);
await app.register(webhookRoutes);

// Initialize Socket.io
initializeSocket(app);

// Start server
try {
  const port = parseInt(env.PORT, 10);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`Server listening on port ${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
