import { Server as SocketIOServer } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import { createAdapter } from '@socket.io/redis-adapter';
import { redis } from './redis.js';

let io: SocketIOServer | null = null;

export function initializeSocket(fastify: FastifyInstance): SocketIOServer {
  io = new SocketIOServer(fastify.server, {
    cors: {
      origin: process.env.WEB_URL || 'http://localhost:3000',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Use Redis adapter for scalability (optional, will work without)
  try {
    const pubClient = redis.duplicate();
    const subClient = redis.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
  } catch {
    console.log('Redis adapter not configured, using in-memory adapter');
  }

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Join user's room for targeted events
    socket.on('join', (userId: string) => {
      socket.join(`user:${userId}`);
      console.log(`Socket ${socket.id} joined room user:${userId}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}

// Emit events to specific user
export function emitEventToUser(userId: string, event: string, data: unknown): void {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

// Event types for calendar sync
export function emitEventCreated(userId: string, eventData: unknown): void {
  emitEventToUser(userId, 'event:created', eventData);
}

export function emitEventUpdated(userId: string, eventData: unknown): void {
  emitEventToUser(userId, 'event:updated', eventData);
}

export function emitEventDeleted(userId: string, eventData: unknown): void {
  emitEventToUser(userId, 'event:deleted', eventData);
}
