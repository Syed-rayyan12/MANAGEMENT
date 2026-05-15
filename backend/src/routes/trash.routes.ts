import { Router } from 'express';
import { getTrash, restoreItem } from '../controllers/trash.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(authorizeRoles('PM', 'PRODUCTION'));

router.get('/', getTrash);
router.post('/restore', restoreItem);

export default router;
