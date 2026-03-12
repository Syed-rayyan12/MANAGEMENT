import { Router } from 'express';
import { getMyTeams, getTeamBySlug, getWorkspaceColumns } from '../controllers/team.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Get teams current user belongs to
router.get('/my-teams', getMyTeams);

// Get workspace columns
router.get('/workspace/:workspaceId/columns', getWorkspaceColumns);

// Get team by slug (must be after other routes)
router.get('/:slug', getTeamBySlug);

export default router;
