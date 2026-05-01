import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { initializeSocket } from './socket.js';
import eventsRouter from './routes/events.js';
import tasksRouter from './routes/tasks.js';
import syncRouter from './routes/sync.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/events', eventsRouter);
app.use('/tasks', tasksRouter);
app.use('/sync', syncRouter);

// Create HTTP server
const server = createServer(app);

// Initialize Socket.io
initializeSocket(server);

// Start server
server.listen(PORT, () => {
  console.log(`[API] Server running on port ${PORT}`);
  console.log(`[API] Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[API] SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('[API] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[API] SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('[API] Server closed');
    process.exit(0);
  });
});
