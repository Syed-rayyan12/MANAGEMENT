import app from './app';
import prisma from './lib/prisma';
import { validateEnv } from './utils/env';

// Validate required env vars before anything else
validateEnv();

const PORT = process.env.PORT || 5000;

// Test database connection
async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  try {
    await connectDatabase();

    // Create HTTP server explicitly (Socket.io needs the raw server)
    const { createServer } = await import('http');
    const httpServer = createServer(app);

    // Initialize Socket.io
    const allowedOrigins = [
      process.env.CLIENT_URL || 'http://localhost:3000',
      'http://localhost:3000',
      'http://localhost:3001',
    ].filter(Boolean) as string[];

    const { initSocket } = await import('./socket/index');
    initSocket(httpServer, allowedOrigins);

    httpServer.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════╗
║   🚀 ProManage Backend Server Running    ║
╠═══════════════════════════════════════════╣
║   Environment: ${process.env.NODE_ENV || 'development'}
║   Port: ${PORT}
║   API: http://localhost:${PORT}
║   Health: http://localhost:${PORT}/health
║   WebSocket: Enabled ✅
╚═══════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
      console.log(`\n🔴 ${signal} received. Shutting down gracefully...`);
      httpServer.close(async () => {
        await prisma.$disconnect();
        console.log('Database disconnected. Process exiting.');
        process.exit(0);
      });

      // Force exit after 10s if graceful shutdown hangs
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Catch unhandled rejections
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

startServer();
