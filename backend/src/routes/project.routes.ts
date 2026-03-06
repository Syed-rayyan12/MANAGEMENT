import { Router } from 'express';
import {
  getLogoDesignProjects,
  getWebDesignProjects,
  getWebDevelopmentProjects,
  getContentWriterProjects,
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addComment,
  updateComment,
  deleteComment,
  updateChecklist,
  addLabel,
  removeLabel,
  addAttachment,
  removeAttachment,
  reorderProjects,
  getActivityLogs,
} from '../controllers/project.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';
import {
  validate,
  createProjectSchema,
  updateProjectSchema,
  addCommentSchema,
  updateCommentSchema,
  updateChecklistSchema,
  addLabelSchema,
  addAttachmentSchema,
} from '../utils/validators';

const router = Router();

// All project routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/projects/logo-design
 * @desc    Get all logo design projects
 * @access  Private
 */
router.get('/logo-design', getLogoDesignProjects);

/**
 * @route   GET /api/projects/web-design
 * @desc    Get all web design projects
 * @access  Private
 */
router.get('/web-design', getWebDesignProjects);

/**
 * @route   GET /api/projects/web-development
 * @desc    Get all web development projects
 * @access  Private
 */
router.get('/web-development', getWebDevelopmentProjects);

/**
 * @route   GET /api/projects/content-writer
 * @desc    Get all content writer projects
 * @access  Private
 */
router.get('/content-writer', getContentWriterProjects);

/**
 * @route   GET /api/projects
 * @desc    Get all projects
 * @access  Private
 */
router.get('/', getAllProjects);

/**
 * @route   POST /api/projects
 * @desc    Create a new project
 * @access  Private (PM only)
 */
router.post('/', authorizeRoles('PM'), validate(createProjectSchema), createProject);

// ─── Reorder (must be before /:id) ─────────────────
router.put('/reorder/batch', reorderProjects);

// ─── Activity Log (must be before /:id) ────────────
router.get('/activity/logs', getActivityLogs);

/**
 * @route   GET /api/projects/:id
 * @desc    Get project by ID
 * @access  Private
 */
router.get('/:id', getProjectById);

/**
 * @route   PUT /api/projects/:id
 * @desc    Update a project (status, checklist, etc.) - all authenticated users
 * @access  Private
 */
router.put('/:id', validate(updateProjectSchema), updateProject);

/**
 * @route   DELETE /api/projects/:id
 * @desc    Delete a project
 * @access  Private (PM only)
 */
router.delete('/:id', authorizeRoles('PM'), deleteProject);

// ─── Comments ──────────────────────────────────────
router.post('/:id/comments', validate(addCommentSchema), addComment);
router.put('/:id/comments/:commentId', validate(updateCommentSchema), updateComment);
router.delete('/:id/comments/:commentId', deleteComment);

// ─── Checklist ─────────────────────────────────────
router.put('/:id/checklist', validate(updateChecklistSchema), updateChecklist);

// ─── Labels ────────────────────────────────────────
router.post('/:id/labels', validate(addLabelSchema), addLabel);
router.delete('/:id/labels/:labelId', removeLabel);

// ─── Attachments ───────────────────────────────────
router.post('/:id/attachments', validate(addAttachmentSchema), addAttachment);
router.delete('/:id/attachments/:attachmentId', removeAttachment);

export default router;
