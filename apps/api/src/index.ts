import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { ApiError } from './lib/errors.js';
import { authMiddleware } from './middleware/auth.js';
import { eventsRouter } from './routes/events.js';

const app = new Hono();

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ error: err.code, message: err.message }, err.statusCode as 400 | 401 | 403 | 404 | 500);
  }
  console.error(err);
  return c.json({ error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' }, 500);
});

app.use('/api/v1/*', authMiddleware);

app.route('/api/v1/events', eventsRouter);

const port = Number(process.env['PORT'] ?? 3001);

serve({ fetch: app.fetch, port }, () => {
  console.log(`API server running on http://localhost:${port}`);
});

export default app;
