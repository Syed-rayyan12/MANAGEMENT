import { Router } from 'express';
import { getPresignedUrl, deleteUpload } from '../controllers/upload.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate, presignSchema } from '../utils/validators';

const router = Router();

// All upload routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/upload/presign
 * @desc    Get a presigned PUT URL for uploading a file directly to R2
 * @access  Private
 */
router.post('/presign', validate(presignSchema), getPresignedUrl);

/**
 * @route   DELETE /api/upload
 * @desc    Delete a file from R2 by key
 * @access  Private
 */
router.delete('/', deleteUpload);

export default router;
