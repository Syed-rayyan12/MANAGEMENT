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

// Load environment variables
dotenv.config();

const app: Application = express();

// ─── Security headers ──────────────────────────────
app.use(helmet());

// ─── Gzip compression ──────────────────────────────
app.use(compression());

// ─── Rate limiting ─────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15, // 15 login attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
});

// ─── CORS ──────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body parsing ──────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Health check (no rate limit) ──────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'ProManage API is running',
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/projects', apiLimiter, projectRoutes);
app.use('/api/dashboard', apiLimiter, dashboardRoutes);
app.use('/api/upload', apiLimiter, uploadRoutes);
app.use('/api/users', apiLimiter, userRoutes);
app.use('/api/notifications', apiLimiter, notificationRoutes);
app.use('/api/teams', apiLimiter, teamRoutes);
app.use('/api/boards', apiLimiter, boardRoutes);

// ─── 404 handler ───────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// ─── Global error handler ──────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

export default app;
