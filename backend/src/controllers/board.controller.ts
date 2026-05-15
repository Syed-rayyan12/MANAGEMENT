import { Request, Response } from 'express';
import prisma from '../lib/prisma';

/**
 * Get all boards (org-level — everyone sees all boards)
 * GET /api/boards
 */
export const getAllBoards = async (_req: Request, res: Response): Promise<void> => {
  try {
    const boards = await prisma.board.findMany({
      include: {
        columns: { orderBy: { position: 'asc' } },
        _count: { select: { projects: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({ success: true, data: { boards } });
  } catch (error) {
    console.error('Get all boards error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get board by slug
 * GET /api/boards/:slug
 */
export const getBoardBySlug = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;

    const board = await prisma.board.findUnique({
      where: { slug },
      include: {
        columns: { orderBy: { position: 'asc' } },
      },
    });

    if (!board) {
      res.status(404).json({ success: false, message: 'Board not found' });
      return;
    }

    res.status(200).json({ success: true, data: { board } });
  } catch (error) {
    console.error('Get board by slug error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get columns for a board
 * GET /api/boards/:boardId/columns
 */
export const getBoardColumns = async (req: Request, res: Response): Promise<void> => {
  try {
    const { boardId } = req.params;

    const columns = await prisma.boardColumn.findMany({
      where: { boardId },
      orderBy: { position: 'asc' },
    });

    res.status(200).json({ success: true, data: { columns } });
  } catch (error) {
    console.error('Get board columns error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Create a new board (workspace)
 * POST /api/boards
 */
export const createBoard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ success: false, message: 'Board name is required' });
      return;
    }

    const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Check for duplicate slug
    const existing = await prisma.board.findUnique({ where: { slug } });
    if (existing) {
      res.status(409).json({ success: false, message: 'A workspace with that name already exists' });
      return;
    }

    // Get the org (single-org system)
    const org = await prisma.organization.findFirst();
    if (!org) {
      res.status(500).json({ success: false, message: 'Organization not found' });
      return;
    }

    const board = await prisma.board.create({
      data: {
        name: name.trim(),
        slug,
        organizationId: org.id,
        columns: {
          create: [
            { name: 'To Do', key: 'todo', color: '#6B7280', position: 0 },
            { name: 'In Progress', key: 'in-progress', color: '#3B82F6', position: 1 },
            { name: 'Completed', key: 'completed', color: '#10B981', position: 2 },
            { name: 'Revisions', key: 'revisions', color: '#F59E0B', position: 3 },
          ],
        },
      },
      include: {
        columns: { orderBy: { position: 'asc' } },
      },
    });

    res.status(201).json({ success: true, message: 'Workspace created', data: { board } });
  } catch (error) {
    console.error('Create board error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Add a column to a board
 * POST /api/boards/:boardId/columns
 */
export const addBoardColumn = async (req: Request, res: Response): Promise<void> => {
  try {
    const { boardId } = req.params;
    const { name, color } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ success: false, message: 'Column name is required' });
      return;
    }

    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) {
      res.status(404).json({ success: false, message: 'Board not found' });
      return;
    }

    const key = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Check for duplicate key on this board
    const existing = await prisma.boardColumn.findUnique({
      where: { boardId_key: { boardId, key } },
    });
    if (existing) {
      res.status(409).json({ success: false, message: 'A column with that name already exists on this board' });
      return;
    }

    // Get next position
    const maxPos = await prisma.boardColumn.aggregate({
      _max: { position: true },
      where: { boardId },
    });

    const column = await prisma.boardColumn.create({
      data: {
        boardId,
        name: name.trim(),
        key,
        color: color || '#6B7280',
        position: (maxPos._max.position ?? -1) + 1,
      },
    });

    res.status(201).json({ success: true, message: 'Column added', data: { column } });
  } catch (error) {
    console.error('Add board column error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
