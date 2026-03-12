import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Build WHERE clause scoped to user's accessible workspaces.
 */
async function buildWhereClause(user: Request['user']): Promise<Record<string, unknown>> {
  if (!user) return { id: 'none' };
  if (user.role === 'EXECUTIVE') return {};
  if (user.role === 'PRODUCTION') return { developerId: user.id };

  if (user.teamIds && user.teamIds.length > 0) {
    const workspaces = await prisma.workspace.findMany({
      where: { teamId: { in: user.teamIds } },
      select: { id: true },
    });
    return { workspaceId: { in: workspaces.map(w => w.id) } };
  }
  return { id: 'none' };
}

/**
 * Get dashboard overview statistics
 * GET /api/dashboard/overview
 */
export const getDashboardOverview = async (req: Request, res: Response): Promise<void> => {
  try {
    const where = await buildWhereClause(req.user);

    // Get all workspaces the user can access
    const workspaces = await prisma.workspace.findMany({
      include: {
        team: { select: { slug: true, name: true } },
        columns: { orderBy: { position: 'asc' } },
      },
    });

    // Workspace counts (dynamic)
    const workspaceStats: Record<string, { name: string; slug: string; count: number }> = {};
    for (const ws of workspaces) {
      const count = await prisma.project.count({
        where: { ...where, workspaceId: ws.id },
      });
      workspaceStats[ws.team.slug] = { name: ws.team.name, slug: ws.team.slug, count };
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
        workspace: { select: { id: true, name: true } },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Dashboard overview retrieved successfully',
      data: {
        workspaceStats,
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

    // Get user's teams and their workspaces
    const teamMembers = await prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: {
          include: {
            workspace: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Managed/Assigned counts per workspace
    const workspaceBreakdown: Record<string, { name: string; managed: number; assigned: number }> = {};
    for (const tm of teamMembers) {
      if (tm.team.workspace) {
        const wsId = tm.team.workspace.id;
        const [managed, assigned] = await Promise.all([
          prisma.project.count({ where: { pmId: userId, workspaceId: wsId } }),
          prisma.project.count({ where: { developerId: userId, workspaceId: wsId } }),
        ]);
        workspaceBreakdown[tm.team.slug] = {
          name: tm.team.name,
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
        workspace: { select: { id: true, name: true } },
      },
    });

    res.status(200).json({
      success: true,
      message: 'User dashboard stats retrieved successfully',
      data: {
        myWorkspaceStats: {
          breakdown: workspaceBreakdown,
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
