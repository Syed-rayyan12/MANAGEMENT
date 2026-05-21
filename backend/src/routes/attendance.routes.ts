import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';
import { validate, editAttendanceSchema } from '../utils/validators';
import {
  checkIn,
  checkOut,
  getToday,
  getMyHistory,
  getTeamAttendance,
  exportMonthly,
  editAttendance,
} from '../controllers/attendance.controller';

const router = Router();

router.use(authenticate);

// Employee actions (TL, PM, PRODUCTION — not EXECUTIVE)
router.post('/check-in', authorizeRoles('TL', 'PM', 'PRODUCTION'), checkIn);
router.post('/check-out', authorizeRoles('TL', 'PM', 'PRODUCTION'), checkOut);
router.get('/today', authorizeRoles('TL', 'PM', 'PRODUCTION'), getToday);
router.get('/my-history', authorizeRoles('TL', 'PM', 'PRODUCTION'), getMyHistory);

// Executive-only views and edits
router.get('/team', authorizeRoles('EXECUTIVE'), getTeamAttendance);
router.get('/export', authorizeRoles('EXECUTIVE'), exportMonthly);
router.put('/:id', authorizeRoles('EXECUTIVE'), validate(editAttendanceSchema), editAttendance);

export default router;
