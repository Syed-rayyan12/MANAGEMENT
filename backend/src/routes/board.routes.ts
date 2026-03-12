import { Router } from 'express';
import { getAllBoards, getBoardBySlug, getBoardColumns } from '../controllers/board.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Get all org-level boards
router.get('/', getAllBoards);

// Get columns for a board (must be before /:slug)
router.get('/:boardId/columns', getBoardColumns);

// Get board by slug
router.get('/:slug', getBoardBySlug);

export default router;
