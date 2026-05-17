import { Router } from 'express';
import { getAllBoards, getBoardBySlug, getBoardColumns, createBoard, addBoardColumn, updateBoardColumn, getAllBoardColumns } from '../controllers/board.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';
import { softDeleteBoard, softDeleteColumn } from '../controllers/trash.controller';

const router = Router();

router.use(authenticate);

// Get all org-level boards
router.get('/', getAllBoards);

// Get all board columns with phase info (must be before /:boardId routes)
router.get('/columns/all', getAllBoardColumns);

// Create a new board (workspace)
router.post('/', createBoard);

// Get columns for a board (must be before /:slug)
router.get('/:boardId/columns', getBoardColumns);

// Add a column to a board
router.post('/:boardId/columns', addBoardColumn);

// Update a column
router.put('/:boardId/columns/:columnId', updateBoardColumn);

// Soft-delete a board
router.post('/:boardId/soft-delete', authorizeRoles('PM', 'PRODUCTION'), softDeleteBoard);

// Soft-delete a column
router.post('/:boardId/columns/:columnId/soft-delete', authorizeRoles('PM', 'PRODUCTION'), softDeleteColumn);

// Get board by slug
router.get('/:slug', getBoardBySlug);

export default router;
