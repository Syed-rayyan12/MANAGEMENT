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
} from '../controllers/project.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

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
router.post('/', authorizeRoles('PM'), createProject);

/**
 * @route   GET /api/projects/:id
 * @desc    Get project by ID
 * @access  Private
 */
router.get('/:id', getProjectById);

/**
 * @route   PUT /api/projects/:id
 * @desc    Update a project
 * @access  Private (PM, TL only)
 */
router.put('/:id', authorizeRoles('PM', 'TL'), updateProject);

/**
 * @route   DELETE /api/projects/:id
 * @desc    Delete a project
 * @access  Private (PM only)
 */
router.delete('/:id', authorizeRoles('PM'), deleteProject);

export default router;
