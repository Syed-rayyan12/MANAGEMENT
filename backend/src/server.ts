import app from './app';
import { PrismaClient } from '@prisma/client';
import { validateEnv } from './utils/env';

// Validate required env vars before anything else
validateEnv();

const PORT = process.env.PORT || 5000;
const prisma = new PrismaClient();

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
    
    const server = app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════╗
║   🚀 ProManage Backend Server Running    ║
╠═══════════════════════════════════════════╣
║   Environment: ${process.env.NODE_ENV || 'development'}
║   Port: ${PORT}
║   API: http://localhost:${PORT}
║   Health: http://localhost:${PORT}/health
╚═══════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
      console.log(`\n🔴 ${signal} received. Shutting down gracefully...`);
      server.close(async () => {
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
