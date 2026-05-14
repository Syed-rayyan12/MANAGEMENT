import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { addAssignment, updateAssignment, removeAssignment } from '../controllers/assignment.controller';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.post('/', addAssignment);
router.put('/:assignmentId', updateAssignment);
router.delete('/:assignmentId', removeAssignment);

export default router;
