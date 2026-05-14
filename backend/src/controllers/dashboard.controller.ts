import { Request, Response } from 'express';
import prisma from '../lib/prisma';

/**
 * Build WHERE clause for project visibility.
 * All authenticated users can see all projects across all teams.
 */
function buildWhereClause(user: Request['user']): Record<string, unknown> {
  if (!user) return { id: 'none' };
  return {};
}

/**
 * Get dashboard overview statistics
 * GET /api/dashboard/overview
 */
export const getDashboardOverview = async (req: Request, res: Response): Promise<void> => {
  try {
    const where = buildWhereClause(req.user);

    // Get all org-level boards
    const boards = await prisma.board.findMany({
      include: {
        columns: { orderBy: { position: 'asc' } },
      },
    });

    // Board counts (projects per board, scoped to user's visibility)
    const boardStats: Record<string, { name: string; slug: string; count: number }> = {};
    for (const board of boards) {
      const count = await prisma.project.count({
        where: { ...where, boardId: board.id },
      });
      boardStats[board.slug] = { name: board.name, slug: board.slug, count };
    }

    const totalProjects = await prisma.project.count({ where });

    // Status counts — get unique statuses from projects
    const statusGroups = await prisma.project.groupBy({
      by: ['status'],
      where,
      _count: true,
    });
    const statusStats: Record<string, number> = {};
    for (const g of statusGroups) {
      statusStats[g.status] = g._count;
    }

    // Priority counts
    const [lowPriority, mediumPriority, highPriority, criticalPriority] = await Promise.all([
      prisma.project.count({ where: { ...where, priority: 'LOW' } }),
      prisma.project.count({ where: { ...where, priority: 'MEDIUM' } }),
      prisma.project.count({ where: { ...where, priority: 'HIGH' } }),
      prisma.project.count({ where: { ...where, priority: 'CRITICAL' } }),
    ]);

    // Recent projects
    const recentProjects = await prisma.project.findMany({
      where,
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        pm: { select: { id: true, name: true } },
        developer: { select: { id: true, name: true } },
        board: { select: { id: true, name: true } },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Dashboard overview retrieved successfully',
      data: {
        boardStats,
        statusStats,
        priorityStats: {
          low: lowPriority,
          medium: mediumPriority,
          high: highPriority,
          critical: criticalPriority,
        },
        totalProjects,
        recentProjects,
      },
    });
  } catch (error) {
    console.error('Get dashboard overview error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get user-specific dashboard stats
 * GET /api/dashboard/my-stats
 */
export const getMyDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const userId = req.user.id;

    // Get all boards
    const boards = await prisma.board.findMany({ select: { id: true, name: true, slug: true } });

    // Managed/Assigned counts per board
    const boardBreakdown: Record<string, { name: string; managed: number; assigned: number }> = {};
    for (const board of boards) {
      const [managed, assigned] = await Promise.all([
        prisma.project.count({ where: { pmId: userId, boardId: board.id } }),
        prisma.project.count({ where: { developerId: userId, boardId: board.id } }),
      ]);
      if (managed > 0 || assigned > 0) {
        boardBreakdown[board.slug] = {
          name: board.name,
          managed,
          assigned,
        };
      }
    }

    const totalManaged = await prisma.project.count({ where: { pmId: userId } });
    const totalAssigned = await prisma.project.count({ where: { developerId: userId } });

    // Recent projects for this user
    const myRecentProjects = await prisma.project.findMany({
      where: { OR: [{ pmId: userId }, { developerId: userId }] },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        pm: { select: { id: true, name: true } },
        developer: { select: { id: true, name: true } },
        board: { select: { id: true, name: true } },
      },
    });

    res.status(200).json({
      success: true,
      message: 'User dashboard stats retrieved successfully',
      data: {
        myBoardStats: {
          breakdown: boardBreakdown,
          totalManaged,
          totalAssigned,
        },
        myRecentProjects,
      },
    });
  } catch (error) {
    console.error('Get user dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
