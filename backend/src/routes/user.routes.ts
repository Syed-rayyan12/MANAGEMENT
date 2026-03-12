import { Router } from 'express';
import { getAllUsers, getUsersByRole, getUserById, updateUserWorkspace } from '../controllers/user.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Private
 */
router.get('/', getAllUsers);

/**
 * @route   GET /api/users/role/:role
 * @desc    Get users by role (PM, TL, EXECUTIVE, PRODUCTION)
 * @access  Private
 */
router.get('/role/:role', getUsersByRole);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
router.get('/:id', getUserById);

/**
 * @route   PATCH /api/users/:id/workspace
 * @desc    Assign a team workspace to a user (PM only)
 * @access  Private (PM)
 */
router.patch('/:id/workspace', updateUserWorkspace);

export default router;
