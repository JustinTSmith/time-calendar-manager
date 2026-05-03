import { Hono } from 'hono';
import { authRoutes } from './auth.js';
import { webhookRoutes } from './webhooks.js';
import { calendarAccountRoutes } from './calendar-accounts.js';

export const apiRoutes = new Hono();

// Health check
apiRoutes.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
apiRoutes.route('/auth', authRoutes);
apiRoutes.route('/webhooks', webhookRoutes);
apiRoutes.route('/calendar-accounts', calendarAccountRoutes);

// 404 handler
apiRoutes.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
apiRoutes.onError((err, c) => {
  console.error('API Error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});
