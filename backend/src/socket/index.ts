import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';

let io: Server | null = null;

export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized — call initSocket first');
  return io;
}

export function initSocket(httpServer: HttpServer, allowedOrigins: string[]) {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  // ─── JWT authentication middleware ─────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const user = verifyToken(token);
      socket.data.user = user; // { id, email, role, teamIds }
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // ─── Connection handler ────────────────────────────
  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    console.log(`[Socket] ${user.email} connected (${socket.id})`);

    // Auto-join personal room for notifications
    socket.join(`user:${user.id}`);

    // Board room management
    socket.on('join:board', (boardSlug: string) => {
      if (typeof boardSlug !== 'string' || !boardSlug) return;
      socket.join(`board:${boardSlug}`);
    });

    socket.on('leave:board', (boardSlug: string) => {
      if (typeof boardSlug !== 'string' || !boardSlug) return;
      socket.leave(`board:${boardSlug}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] ${user.email} disconnected (${socket.id})`);
    });
  });

  console.log('✅ Socket.io initialized');
  return io;
}
