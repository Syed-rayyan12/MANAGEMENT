import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import dashboardRoutes from './routes/dashboard.routes';
import uploadRoutes from './routes/upload.routes';
import userRoutes from './routes/user.routes';
import notificationRoutes from './routes/notification.routes';
import teamRoutes from './routes/team.routes';
import boardRoutes from './routes/board.routes';
import invoiceRoutes from './routes/invoice.routes';
import webhookRoutes from './routes/webhook.routes';
import adminRoutes from './routes/admin.routes';
import clientRoutes from './routes/client.routes';
import trashRoutes from './routes/trash.routes';
import performanceRoutes from './routes/performance.routes';
import trelloRoutes from './routes/trello.routes';
import attendanceRoutes from './routes/attendance.routes';

import { purgeExpiredTrash } from './controllers/trash.controller';

// ───────────────────────────────────────────────────
// Load environment variables
// ───────────────────────────────────────────────────
dotenv.config();

const app: Application = express();

// ───────────────────────────────────────────────────
// Trust Railway proxy
// ───────────────────────────────────────────────────
app.set('trust proxy', 1);

// ───────────────────────────────────────────────────
// Security headers
// ───────────────────────────────────────────────────
app.use(helmet());

// ───────────────────────────────────────────────────
// Compression
// ───────────────────────────────────────────────────
app.use(compression({
  filter: (req, res) => {
    // Disable compression for SSE streams
    if (res.getHeader('Content-Type') === 'text/event-stream') return false;
    return compression.filter(req, res);
  },
}));

// ───────────────────────────────────────────────────
// Rate limiting
// ───────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.',
  },
});

// ───────────────────────────────────────────────────
// Allowed origins
// ───────────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean);

// ───────────────────────────────────────────────────
// CORS
// ───────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow mobile apps / Postman / curl
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },

    credentials: true,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-socket-id',
    ],
  })
);

// Handle preflight requests
app.options('*', cors());

// ───────────────────────────────────────────────────
// Body parsers
// ───────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ───────────────────────────────────────────────────
// Health check
// ───────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'ProManage API is running',
    timestamp: new Date().toISOString(),
  });
});

// ───────────────────────────────────────────────────
// API Routes
// ───────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/projects', apiLimiter, projectRoutes);
app.use('/api/dashboard', apiLimiter, dashboardRoutes);
app.use('/api/upload', apiLimiter, uploadRoutes);
app.use('/api/users', apiLimiter, userRoutes);
app.use('/api/notifications', apiLimiter, notificationRoutes);
app.use('/api/teams', apiLimiter, teamRoutes);
app.use('/api/boards', apiLimiter, boardRoutes);
app.use('/api/invoices', apiLimiter, invoiceRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/admin', apiLimiter, adminRoutes);
app.use('/api/clients', apiLimiter, clientRoutes);
app.use('/api/trash', apiLimiter, trashRoutes);
app.use('/api/performance', apiLimiter, performanceRoutes);
app.use('/api/trello', apiLimiter, trelloRoutes);
app.use('/api/attendance', apiLimiter, attendanceRoutes);

// ───────────────────────────────────────────────────
// Auto purge expired trash
// ───────────────────────────────────────────────────
purgeExpiredTrash();

// ───────────────────────────────────────────────────
// 404 handler
// ───────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// ───────────────────────────────────────────────────
// Global error handler
// ───────────────────────────────────────────────────
app.use(
  (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err.message);

    res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : err.message,
    });
  }
);

export default app;