import { Router } from 'express';
import {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../controllers/notification.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// GET /api/notifications — get current user's notifications
router.get('/', getMyNotifications);

// GET /api/notifications/unread-count — quick badge count
router.get('/unread-count', getUnreadCount);

// PUT /api/notifications/read-all — mark all as read
router.put('/read-all', markAllAsRead);

// PUT /api/notifications/:id/read — mark single as read
router.put('/:id/read', markAsRead);

export default router;
