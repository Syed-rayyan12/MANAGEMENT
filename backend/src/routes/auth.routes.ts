import { Router } from 'express';
import { login, getMe, verifyPassword, updateMe, changePassword } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate, loginSchema, updateProfileSchema, changePasswordSchema } from '../utils/validators';

const router = Router();

/**
 * @route   POST /api/auth/login
 * @desc    Login user with predefined credentials
 * @access  Public
 */
router.post('/login', validate(loginSchema), login);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private (requires authentication)
 */
router.get('/me', authenticate, getMe);

/**
 * @route   PATCH /api/auth/me
 * @desc    Update current user's own profile (name, email, specialization, avatar)
 * @access  Private (requires authentication)
 */
router.patch('/me', authenticate, validate(updateProfileSchema), updateMe);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change current user's password (requires current password)
 * @access  Private (requires authentication)
 */
router.post('/change-password', authenticate, validate(changePasswordSchema), changePassword);

/**
 * @route   POST /api/auth/verify-password
 * @desc    Verify the current user's password
 * @access  Private (requires authentication)
 */
router.post('/verify-password', authenticate, verifyPassword);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (stateless, just for frontend symmetry)
 * @access  Public
 */
router.post('/logout', (_req, res) => {
  // If you use refresh tokens, remove them from DB here
  // For JWT, just respond OK (frontend will remove token)
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;
