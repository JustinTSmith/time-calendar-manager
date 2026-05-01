import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import type { UserPayload } from '../middleware/auth.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret';

export function setupSocketAuth(io: Server) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;

    if (!token) {
      return next(new Error('AUTH_REQUIRED'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
      socket.data.user = decoded;
      next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return next(new Error('AUTH_EXPIRED'));
      }
      return next(new Error('AUTH_REQUIRED'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}, user: ${socket.data.user?.userId}`);

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}
