import { Router } from 'express';
import {
  getBoardProjects,
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
import { softDeleteProject } from '../controllers/trash.controller';
import assignmentRoutes from './assignment.routes';
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

// ─── Get projects by board ID ──────────────────
router.get('/board/:boardId', getBoardProjects);

// ─── Get all projects (scoped to user) ─────────────
router.get('/', getAllProjects);

// ─── Create a new project ──────────────────────────
router.post('/', validate(createProjectSchema), createProject);

// ─── Reorder (must be before /:id) ─────────────────
router.put('/reorder/batch', reorderProjects);

// ─── Activity Log (must be before /:id) ────────────
router.get('/activity/logs', getActivityLogs);

// ─── Soft-delete a project ────────────────────────
router.post('/:id/soft-delete', authorizeRoles('PM', 'PRODUCTION'), softDeleteProject);

// ─── Get project by ID ────────────────────────────
router.get('/:id', getProjectById);

// ─── Update a project ─────────────────────────────
router.put('/:id', validate(updateProjectSchema), updateProject);

// ─── Delete a project ─────────────────────────────
router.delete('/:id', authorizeRoles('PM', 'PRODUCTION'), deleteProject);

// ─── Comments ──────────────────────────────────────
router.post('/:id/comments', validate(addCommentSchema), addComment);
router.put('/:id/comments/:commentId', validate(updateCommentSchema), updateComment);
router.delete('/:id/comments/:commentId', deleteComment);

// ─── Checklist ─────────────────────────────────────
router.put('/:id/checklist', validate(updateChecklistSchema), updateChecklist);

// ─── Assignment routes (nested under /api/projects/:id/assignments) ────────────
router.use('/:id/assignments', assignmentRoutes);

// ─── Labels ────────────────────────────────────────
router.post('/:id/labels', validate(addLabelSchema), addLabel);
router.delete('/:id/labels/:labelId', removeLabel);

// ─── Attachments ───────────────────────────────────
router.post('/:id/attachments', validate(addAttachmentSchema), addAttachment);
router.delete('/:id/attachments/:attachmentId', removeAttachment);

export default router;
