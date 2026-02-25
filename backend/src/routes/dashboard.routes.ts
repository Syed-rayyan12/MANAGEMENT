import { Router } from 'express';
import { getDashboardOverview, getMyDashboardStats } from '../controllers/dashboard.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// All dashboard routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/dashboard/overview
 * @desc    Get dashboard overview with workspace stats
 * @access  Private
 */
router.get('/overview', getDashboardOverview);

/**
 * @route   GET /api/dashboard/my-stats
 * @desc    Get user-specific dashboard statistics
 * @access  Private
 */
router.get('/my-stats', getMyDashboardStats);

export default router;
