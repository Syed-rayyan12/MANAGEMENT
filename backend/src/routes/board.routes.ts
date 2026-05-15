import { Router } from 'express';
import { getAllBoards, getBoardBySlug, getBoardColumns, createBoard, addBoardColumn } from '../controllers/board.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Get all org-level boards
router.get('/', getAllBoards);

// Create a new board (workspace)
router.post('/', createBoard);

// Get columns for a board (must be before /:slug)
router.get('/:boardId/columns', getBoardColumns);

// Add a column to a board
router.post('/:boardId/columns', addBoardColumn);

// Get board by slug
router.get('/:slug', getBoardBySlug);

export default router;
