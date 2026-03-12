import { Router } from 'express';
import { getMyTeams, getTeamBySlug } from '../controllers/team.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Get teams current user belongs to
router.get('/my-teams', getMyTeams);

// Get team by slug
router.get('/:slug', getTeamBySlug);

export default router;
