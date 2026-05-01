import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export let io: SocketIOServer;

export function initializeSocket(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;

    if (!token) {
      return next(new Error('Authentication error: Missing token'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      // Store userId on socket for later use
      socket.data.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;

    console.log(`[Socket] User ${userId} connected: ${socket.id}`);

    // Join user to their own room for targeted emits
    socket.join(userId);

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] User ${userId} disconnected: ${reason}`);
    });

    socket.on('error', (error) => {
      console.error(`[Socket] Error for user ${userId}:`, error);
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
