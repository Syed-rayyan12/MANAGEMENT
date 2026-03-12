import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
