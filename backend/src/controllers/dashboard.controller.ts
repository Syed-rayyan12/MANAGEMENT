import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Build a role-based where clause.
 * All users see all projects (Trello-like board visibility).
 */
function buildWhereClause(_user: Request['user']) {
  return {};
}

/**
 * Get dashboard overview statistics
 * GET /api/dashboard/overview
 */
export const getDashboardOverview = async (req: Request, res: Response): Promise<void> => {
  try {
    const where = buildWhereClause(req.user);

    // Workspace counts
    const [logoCount, webDesignCount, webDevelopmentCount, contentCount] = await Promise.all([
      prisma.project.count({ where: { ...where, workspace: 'LOGO' } }),
      prisma.project.count({ where: { ...where, workspace: 'WEB_DESIGN' } }),
      prisma.project.count({ where: { ...where, workspace: 'WEB_DEVELOPMENT' } }),
      prisma.project.count({ where: { ...where, workspace: 'CONTENT' } }),
    ]);

    const totalProjects = logoCount + webDesignCount + webDevelopmentCount + contentCount;

    // Status counts
    const [todoCount, inProgressCount, completedCount, revisionsCount] = await Promise.all([
      prisma.project.count({ where: { ...where, status: 'TODO' } }),
      prisma.project.count({ where: { ...where, status: 'IN_PROGRESS' } }),
      prisma.project.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.project.count({ where: { ...where, status: 'REVISIONS' } }),
    ]);

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
      },
    });

    res.status(200).json({
      success: true,
      message: 'Dashboard overview retrieved successfully',
      data: {
        workspaceStats: {
          logoDesign: logoCount,
          webDesign: webDesignCount,
          webDevelopment: webDevelopmentCount,
          contentWriter: contentCount,
        },
        statusStats: {
          todo: todoCount,
          inProgress: inProgressCount,
          completed: completedCount,
          revisions: revisionsCount,
        },
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

    // Managed counts by workspace
    const [logoManaged, webDesignManaged, webDevManaged, contentManaged] = await Promise.all([
      prisma.project.count({ where: { pmId: userId, workspace: 'LOGO' } }),
      prisma.project.count({ where: { pmId: userId, workspace: 'WEB_DESIGN' } }),
      prisma.project.count({ where: { pmId: userId, workspace: 'WEB_DEVELOPMENT' } }),
      prisma.project.count({ where: { pmId: userId, workspace: 'CONTENT' } }),
    ]);

    // Assigned counts by workspace
    const [logoAssigned, webDesignAssigned, webDevAssigned, contentAssigned] = await Promise.all([
      prisma.project.count({ where: { developerId: userId, workspace: 'LOGO' } }),
      prisma.project.count({ where: { developerId: userId, workspace: 'WEB_DESIGN' } }),
      prisma.project.count({ where: { developerId: userId, workspace: 'WEB_DEVELOPMENT' } }),
      prisma.project.count({ where: { developerId: userId, workspace: 'CONTENT' } }),
    ]);

    const totalManaged = logoManaged + webDesignManaged + webDevManaged + contentManaged;
    const totalAssigned = logoAssigned + webDesignAssigned + webDevAssigned + contentAssigned;

    // Recent projects for this user
    const myRecentProjects = await prisma.project.findMany({
      where: { OR: [{ pmId: userId }, { developerId: userId }] },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        pm: { select: { id: true, name: true } },
        developer: { select: { id: true, name: true } },
      },
    });

    res.status(200).json({
      success: true,
      message: 'User dashboard stats retrieved successfully',
      data: {
        myWorkspaceStats: {
          managed: {
            logoDesign: logoManaged,
            webDesign: webDesignManaged,
            webDevelopment: webDevManaged,
            contentWriter: contentManaged,
            total: totalManaged,
          },
          assigned: {
            logoDesign: logoAssigned,
            webDesign: webDesignAssigned,
            webDevelopment: webDevAssigned,
            contentWriter: contentAssigned,
            total: totalAssigned,
          },
        },
        myRecentProjects,
      },
    });
  } catch (error) {
    console.error('Get user dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
