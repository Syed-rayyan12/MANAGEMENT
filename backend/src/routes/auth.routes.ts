import { Router } from 'express';
import { login, getMe } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Debug endpoint - test if body is being received
router.post('/test', (req, res) => {
  console.log('=== TEST ENDPOINT ===');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('Type of body:', typeof req.body);
  console.log('Body keys:', Object.keys(req.body));
  
  res.json({
    success: true,
    message: 'Test endpoint',
    receivedHeaders: req.headers,
    receivedBody: req.body,
    bodyType: typeof req.body,
    bodyKeys: Object.keys(req.body)
  });
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user with predefined credentials
 * @access  Public
 */
router.post('/login', (req, _res, next) => {
  console.log('=== LOGIN REQUEST ===');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('Body username:', req.body?.username);
  console.log('Body password:', req.body?.password);
  next();
}, login);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private (requires authentication)
 */
router.get('/me', authenticate, getMe);


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
