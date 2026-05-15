import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { emitBoardEvent } from '../socket/emitHelper';

export const softDeleteBoard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { boardId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const board = await prisma.board.findFirst({ where: { id: boardId, deletedAt: null } });
    if (!board) {
      res.status(404).json({ success: false, message: 'Board not found' });
      return;
    }

    const now = new Date();

    await prisma.$transaction([
      prisma.board.update({
        where: { id: boardId },
        data: { deletedAt: now, deletedById: userId },
      }),
      prisma.boardColumn.updateMany({
        where: { boardId, deletedAt: null },
        data: { deletedAt: now, deletedById: userId },
      }),
      prisma.project.updateMany({
        where: { boardId, deletedAt: null },
        data: { deletedAt: now, deletedById: userId },
      }),
    ]);

    res.status(200).json({ success: true, message: 'Board moved to trash' });
  } catch (error) {
    console.error('Soft delete board error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const softDeleteColumn = async (req: Request, res: Response): Promise<void> => {
  try {
    const { boardId, columnId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const column = await prisma.boardColumn.findFirst({
      where: { id: columnId, boardId, deletedAt: null },
    });
    if (!column) {
      res.status(404).json({ success: false, message: 'Column not found' });
      return;
    }

    const now = new Date();

    await prisma.$transaction([
      prisma.boardColumn.update({
        where: { id: columnId },
        data: { deletedAt: now, deletedById: userId },
      }),
      prisma.project.updateMany({
        where: { boardId, status: column.key, deletedAt: null },
        data: { deletedAt: now, deletedById: userId },
      }),
    ]);

    res.status(200).json({ success: true, message: 'Column moved to trash' });
  } catch (error) {
    console.error('Soft delete column error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const softDeleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
    if (!project) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }

    await prisma.project.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: userId },
    });

    await prisma.activityLog.create({
      data: { action: `Moved project to trash: ${project.name}`, userId },
    });

    res.status(200).json({ success: true, message: 'Project moved to trash' });
  } catch (error) {
    console.error('Soft delete project error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getTrash = async (_req: Request, res: Response): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [boards, columns, projects] = await Promise.all([
      prisma.board.findMany({
        where: { deletedAt: { not: null, gte: thirtyDaysAgo } },
        include: {
          deletedBy: { select: { id: true, name: true } },
          _count: {
            select: {
              columns: { where: { deletedAt: { not: null } } },
              projects: { where: { deletedAt: { not: null } } },
            },
          },
        },
        orderBy: { deletedAt: 'desc' },
      }),
      prisma.boardColumn.findMany({
        where: {
          deletedAt: { not: null, gte: thirtyDaysAgo },
          board: { deletedAt: null },
        },
        include: {
          board: { select: { id: true, name: true, slug: true } },
          deletedBy: { select: { id: true, name: true } },
        },
        orderBy: { deletedAt: 'desc' },
      }),
      prisma.project.findMany({
        where: {
          deletedAt: { not: null, gte: thirtyDaysAgo },
          board: { deletedAt: null },
        },
        include: {
          board: { select: { id: true, name: true, slug: true } },
          deletedBy: { select: { id: true, name: true } },
        },
        orderBy: { deletedAt: 'desc' },
      }),
    ]);

    const now = new Date();
    const addDaysRemaining = (item: any) => ({
      ...item,
      daysRemaining: Math.max(0, 30 - Math.floor((now.getTime() - new Date(item.deletedAt).getTime()) / (1000 * 60 * 60 * 24))),
    });

    res.status(200).json({
      success: true,
      data: {
        boards: boards.map(addDaysRemaining),
        columns: columns.map(addDaysRemaining),
        projects: projects.map(addDaysRemaining),
      },
    });
  } catch (error) {
    console.error('Get trash error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const restoreItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, id } = req.body;

    if (!type || !id) {
      res.status(400).json({ success: false, message: 'type and id are required' });
      return;
    }

    if (type === 'board') {
      const board = await prisma.board.findFirst({ where: { id, deletedAt: { not: null } } });
      if (!board) {
        res.status(404).json({ success: false, message: 'Deleted board not found' });
        return;
      }

      const conflict = await prisma.board.findFirst({ where: { slug: board.slug, deletedAt: null } });
      const newSlug = conflict ? `${board.slug}-restored` : board.slug;

      const deletedAt = board.deletedAt!;
      const windowStart = new Date(deletedAt.getTime() - 1000);
      const windowEnd = new Date(deletedAt.getTime() + 1000);

      await prisma.$transaction([
        prisma.board.update({
          where: { id },
          data: { deletedAt: null, deletedById: null, slug: newSlug },
        }),
        prisma.boardColumn.updateMany({
          where: {
            boardId: id,
            deletedAt: { gte: windowStart, lte: windowEnd },
          },
          data: { deletedAt: null, deletedById: null },
        }),
        prisma.project.updateMany({
          where: {
            boardId: id,
            deletedAt: { gte: windowStart, lte: windowEnd },
          },
          data: { deletedAt: null, deletedById: null },
        }),
      ]);

      res.status(200).json({ success: true, message: 'Board restored' });
    } else if (type === 'column') {
      const column = await prisma.boardColumn.findFirst({
        where: { id, deletedAt: { not: null } },
        include: { board: { select: { deletedAt: true } } },
      });
      if (!column) {
        res.status(404).json({ success: false, message: 'Deleted column not found' });
        return;
      }
      if (column.board.deletedAt) {
        res.status(400).json({ success: false, message: 'Cannot restore column — its board is also deleted. Restore the board first.' });
        return;
      }

      const deletedAt = column.deletedAt!;
      const windowStart = new Date(deletedAt.getTime() - 1000);
      const windowEnd = new Date(deletedAt.getTime() + 1000);

      await prisma.$transaction([
        prisma.boardColumn.update({
          where: { id },
          data: { deletedAt: null, deletedById: null },
        }),
        prisma.project.updateMany({
          where: {
            boardId: column.boardId,
            status: column.key,
            deletedAt: { gte: windowStart, lte: windowEnd },
          },
          data: { deletedAt: null, deletedById: null },
        }),
      ]);

      res.status(200).json({ success: true, message: 'Column restored' });
    } else if (type === 'project') {
      const project = await prisma.project.findFirst({
        where: { id, deletedAt: { not: null } },
        include: { board: { select: { deletedAt: true } } },
      });
      if (!project) {
        res.status(404).json({ success: false, message: 'Deleted project not found' });
        return;
      }
      if (project.board.deletedAt) {
        res.status(400).json({ success: false, message: 'Cannot restore project — its board is deleted. Restore the board first.' });
        return;
      }

      await prisma.project.update({
        where: { id },
        data: { deletedAt: null, deletedById: null },
      });

      // Broadcast project reappearance
      const restoredProject = await prisma.project.findUnique({
        where: { id },
        include: {
          assignments: {
            include: {
              user: { select: { id: true, name: true, email: true, avatar: true, role: true, specialization: true } },
            },
            orderBy: { assignedAt: 'asc' as const },
          },
          comments: { select: { id: true } },
          checklist: { orderBy: { position: 'asc' as const } },
          labels: { include: { label: true } },
          attachments: { select: { id: true } },
          board: { select: { id: true, name: true, slug: true } },
          team: { select: { id: true, name: true, slug: true } },
          client: { select: { id: true, name: true, contactEmail: true } },
        },
      });
      if (restoredProject?.board?.slug) {
        emitBoardEvent(
          restoredProject.board.slug,
          'project:created',
          restoredProject,
          req.headers['x-socket-id'] as string | undefined,
        );
      }

      res.status(200).json({ success: true, message: 'Project restored' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid type. Must be board, column, or project.' });
    }
  } catch (error) {
    console.error('Restore item error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const purgeExpiredTrash = async (): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [deletedProjects, deletedColumns, deletedBoards] = await prisma.$transaction([
      prisma.project.deleteMany({ where: { deletedAt: { lt: thirtyDaysAgo } } }),
      prisma.boardColumn.deleteMany({ where: { deletedAt: { lt: thirtyDaysAgo } } }),
      prisma.board.deleteMany({ where: { deletedAt: { lt: thirtyDaysAgo } } }),
    ]);

    const total = deletedProjects.count + deletedColumns.count + deletedBoards.count;
    if (total > 0) {
      console.log(`Purged ${total} expired trash items (${deletedBoards.count} boards, ${deletedColumns.count} columns, ${deletedProjects.count} projects)`);
    }
  } catch (error) {
    console.error('Purge expired trash error:', error);
  }
};
