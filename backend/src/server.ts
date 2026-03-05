import app from './app';
import { PrismaClient } from '@prisma/client';

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
    
    app.listen(PORT, () => {
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
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🔴 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔴 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
