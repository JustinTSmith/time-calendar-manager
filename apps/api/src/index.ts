import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { apiRoutes } from './routes/index.js';
import { env } from './config/env.js';
import './jobs/workers.js'; // Initialize workers

const app = new Hono();

// Middleware
app.use(logger());
app.use(cors({
  origin: '*', // Configure appropriately for production
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Mount API routes
app.route('/api/v1', apiRoutes);

// Start server
const port = parseInt(env.PORT, 10);

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`🚀 Server running at http://localhost:${info.port}`);
  console.log(`📅 Microsoft Outlook OAuth: http://localhost:${info.port}/api/v1/auth/microsoft`);
  console.log(`🔔 Webhook endpoint: http://localhost:${info.port}/api/v1/webhooks/microsoft`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  // Close queue connections
  const { closeQueueConnections } = await import('./lib/queue.js');
  await closeQueueConnections();
  
  // Close database connection
  const { closeDbConnection } = await import('./lib/db.js');
  await closeDbConnection();
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  
  // Close queue connections
  const { closeQueueConnections } = await import('./lib/queue.js');
  await closeQueueConnections();
  
  // Close database connection
  const { closeDbConnection } = await import('./lib/db.js');
  await closeDbConnection();
  
  process.exit(0);
});
