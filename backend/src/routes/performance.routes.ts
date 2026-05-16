import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { getMyPerformance } from '../controllers/performance.controller';

const router = Router();
router.use(authenticate);
router.get('/me', getMyPerformance);

export default router;
