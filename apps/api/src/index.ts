import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './middleware/auth.js';
import { calendarsRouter } from './routes/calendars.js';

const app = new Hono();

app.use(
  '*',
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    allowHeaders: ['Content-Type', 'X-User-Id'],
    allowMethods: ['GET', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  }),
);

app.use('/api/*', authMiddleware);

app.route('/api/v1/calendars', calendarsRouter);

app.get('/health', (c) => c.json({ status: 'ok' }));

const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port }, () => {
  console.log(`API server running on http://localhost:${port}`);
});
