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
      where: { deletedAt: null },
      include: {
        columns: { where: { deletedAt: null }, orderBy: { position: 'asc' } },
      },
    });

    // Single groupBy instead of N+1 count loop
    const projectCountsByBoard = await prisma.project.groupBy({
      by: ['boardId'],
      where,
      _count: { id: true },
    });
    const countMap = new Map(projectCountsByBoard.map(g => [g.boardId, g._count.id]));

    const boardStats: Record<string, { name: string; slug: string; count: number }> = {};
    for (const board of boards) {
      boardStats[board.slug] = { name: board.name, slug: board.slug, count: countMap.get(board.id) || 0 };
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
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        assignments: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
          take: 3,
        },
        board: { select: { name: true, slug: true } },
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

    const user = req.user;

    // Get all project IDs the user is assigned to
    const myAssignments = await prisma.projectAssignment.findMany({
      where: { userId: user.id },
      select: { projectId: true },
    });
    const myProjectIds = myAssignments.map(a => a.projectId);

    // Get board breakdown for assigned projects
    const boardBreakdown = await prisma.project.groupBy({
      by: ['boardId'],
      where: { id: { in: myProjectIds } },
      _count: { id: true },
    });

    const boardIds = boardBreakdown.map(b => b.boardId);
    const boardsInfo = await prisma.board.findMany({
      where: { id: { in: boardIds }, deletedAt: null },
      select: { id: true, name: true, slug: true },
    });

    const breakdown: Record<string, { name: string; count: number }> = {};
    for (const b of boardBreakdown) {
      const info = boardsInfo.find(bi => bi.id === b.boardId);
      if (info) {
        breakdown[info.slug] = { name: info.name, count: b._count.id };
      }
    }

    // Recent projects for this user
    const myRecentProjects = await prisma.project.findMany({
      where: { id: { in: myProjectIds }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        assignments: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
        board: { select: { name: true, slug: true } },
      },
    });

    res.status(200).json({
      success: true,
      data: {
        myBoardStats: {
          breakdown,
          totalProjects: myProjectIds.length,
        },
        myRecentProjects,
      },
    });
  } catch (error) {
    console.error('Get user dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
