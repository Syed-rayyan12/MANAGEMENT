import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get dashboard overview statistics
 * GET /api/dashboard/overview
 */
export const getDashboardOverview = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    
    // Build filter based on user role
    let whereClause: any = {};
    
    if (user?.role === 'PM') {
      whereClause.pmId = user.id;
    } else if (user?.role === 'TL' || user?.role === 'PRODUCTION') {
      whereClause.developerId = user.id;
    }
    // Executive sees all projects (no filter)
    
    // Get counts for each workspace type from separate tables
    const [logoCount, webDesignCount, webDevelopmentCount, contentCount] = await Promise.all([
      prisma.logoDesignProject.count({ where: whereClause }),
      prisma.webDesignProject.count({ where: whereClause }),
      prisma.webDevelopmentProject.count({ where: whereClause }),
      prisma.contentWriterProject.count({ where: whereClause }),
    ]);

    const totalProjects = logoCount + webDesignCount + webDevelopmentCount + contentCount;

    // Get status breakdown from all tables
    const [
      logoStatuses,
      webDesignStatuses,
      webDevStatuses,
      contentStatuses,
    ] = await Promise.all([
      Promise.all([
        prisma.logoDesignProject.count({ where: { ...whereClause, status: 'TODO' } }),
        prisma.logoDesignProject.count({ where: { ...whereClause, status: 'IN_PROGRESS' } }),
        prisma.logoDesignProject.count({ where: { ...whereClause, status: 'COMPLETED' } }),
        prisma.logoDesignProject.count({ where: { ...whereClause, status: 'REVISIONS' } }),
      ]),
      Promise.all([
        prisma.webDesignProject.count({ where: { ...whereClause, status: 'TODO' } }),
        prisma.webDesignProject.count({ where: { ...whereClause, status: 'IN_PROGRESS' } }),
        prisma.webDesignProject.count({ where: { ...whereClause, status: 'COMPLETED' } }),
        prisma.webDesignProject.count({ where: { ...whereClause, status: 'REVISIONS' } }),
      ]),
      Promise.all([
        prisma.webDevelopmentProject.count({ where: { ...whereClause, status: 'TODO' } }),
        prisma.webDevelopmentProject.count({ where: { ...whereClause, status: 'IN_PROGRESS' } }),
        prisma.webDevelopmentProject.count({ where: { ...whereClause, status: 'COMPLETED' } }),
        prisma.webDevelopmentProject.count({ where: { ...whereClause, status: 'REVISIONS' } }),
      ]),
      Promise.all([
        prisma.contentWriterProject.count({ where: { ...whereClause, status: 'TODO' } }),
        prisma.contentWriterProject.count({ where: { ...whereClause, status: 'IN_PROGRESS' } }),
        prisma.contentWriterProject.count({ where: { ...whereClause, status: 'COMPLETED' } }),
        prisma.contentWriterProject.count({ where: { ...whereClause, status: 'REVISIONS' } }),
      ]),
    ]);

    const todoCount = logoStatuses[0] + webDesignStatuses[0] + webDevStatuses[0] + contentStatuses[0];
    const inProgressCount = logoStatuses[1] + webDesignStatuses[1] + webDevStatuses[1] + contentStatuses[1];
    const completedCount = logoStatuses[2] + webDesignStatuses[2] + webDevStatuses[2] + contentStatuses[2];
    const revisionsCount = logoStatuses[3] + webDesignStatuses[3] + webDevStatuses[3] + contentStatuses[3];

    // Get priority breakdown from all tables
    const [
      logoPriorities,
      webDesignPriorities,
      webDevPriorities,
      contentPriorities,
    ] = await Promise.all([
      Promise.all([
        prisma.logoDesignProject.count({ where: { ...whereClause, priority: 'LOW' } }),
        prisma.logoDesignProject.count({ where: { ...whereClause, priority: 'MEDIUM' } }),
        prisma.logoDesignProject.count({ where: { ...whereClause, priority: 'HIGH' } }),
        prisma.logoDesignProject.count({ where: { ...whereClause, priority: 'CRITICAL' } }),
      ]),
      Promise.all([
        prisma.webDesignProject.count({ where: { ...whereClause, priority: 'LOW' } }),
        prisma.webDesignProject.count({ where: { ...whereClause, priority: 'MEDIUM' } }),
        prisma.webDesignProject.count({ where: { ...whereClause, priority: 'HIGH' } }),
        prisma.webDesignProject.count({ where: { ...whereClause, priority: 'CRITICAL' } }),
      ]),
      Promise.all([
        prisma.webDevelopmentProject.count({ where: { ...whereClause, priority: 'LOW' } }),
        prisma.webDevelopmentProject.count({ where: { ...whereClause, priority: 'MEDIUM' } }),
        prisma.webDevelopmentProject.count({ where: { ...whereClause, priority: 'HIGH' } }),
        prisma.webDevelopmentProject.count({ where: { ...whereClause, priority: 'CRITICAL' } }),
      ]),
      Promise.all([
        prisma.contentWriterProject.count({ where: { ...whereClause, priority: 'LOW' } }),
        prisma.contentWriterProject.count({ where: { ...whereClause, priority: 'MEDIUM' } }),
        prisma.contentWriterProject.count({ where: { ...whereClause, priority: 'HIGH' } }),
        prisma.contentWriterProject.count({ where: { ...whereClause, priority: 'CRITICAL' } }),
      ]),
    ]);

    const lowPriority = logoPriorities[0] + webDesignPriorities[0] + webDevPriorities[0] + contentPriorities[0];
    const mediumPriority = logoPriorities[1] + webDesignPriorities[1] + webDevPriorities[1] + contentPriorities[1];
    const highPriority = logoPriorities[2] + webDesignPriorities[2] + webDevPriorities[2] + contentPriorities[2];
    const criticalPriority = logoPriorities[3] + webDesignPriorities[3] + webDevPriorities[3] + contentPriorities[3];

    // Get recent projects from all tables
    const [logoRecent, webDesignRecent, webDevRecent, contentRecent] = await Promise.all([
      prisma.logoDesignProject.findMany({
        where: whereClause,
        take: 2,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.webDesignProject.findMany({
        where: whereClause,
        take: 2,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.webDevelopmentProject.findMany({
        where: whereClause,
        take: 2,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contentWriterProject.findMany({
        where: whereClause,
        take: 2,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const recentProjects = [
      ...logoRecent.map(p => ({ ...p, workspace: 'LOGO' })),
      ...webDesignRecent.map(p => ({ ...p, workspace: 'WEB_DESIGN' })),
      ...webDevRecent.map(p => ({ ...p, workspace: 'WEB_DEVELOPMENT' })),
      ...contentRecent.map(p => ({ ...p, workspace: 'CONTENT' })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

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
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Get user-specific dashboard stats
 * GET /api/dashboard/my-stats
 */
export const getMyDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const userId = req.user.id;

    // Get counts for projects managed by the user
    const [logoManaged, webDesignManaged, webDevManaged, contentManaged] = await Promise.all([
      prisma.logoDesignProject.count({ where: { pmId: userId } }),
      prisma.webDesignProject.count({ where: { pmId: userId } }),
      prisma.webDevelopmentProject.count({ where: { pmId: userId } }),
      prisma.contentWriterProject.count({ where: { pmId: userId } }),
    ]);

    // Get counts for projects assigned to the user
    const [logoAssigned, webDesignAssigned, webDevAssigned, contentAssigned] = await Promise.all([
      prisma.logoDesignProject.count({ where: { developerId: userId } }),
      prisma.webDesignProject.count({ where: { developerId: userId } }),
      prisma.webDevelopmentProject.count({ where: { developerId: userId } }),
      prisma.contentWriterProject.count({ where: { developerId: userId } }),
    ]);

    const totalManaged = logoManaged + webDesignManaged + webDevManaged + contentManaged;
    const totalAssigned = logoAssigned + webDesignAssigned + webDevAssigned + contentAssigned;

    // Get recent projects for the user
    const [logoRecentManaged, webDesignRecentManaged, webDevRecentManaged, contentRecentManaged] = await Promise.all([
      prisma.logoDesignProject.findMany({
        where: { OR: [{ pmId: userId }, { developerId: userId }] },
        take: 2,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.webDesignProject.findMany({
        where: { OR: [{ pmId: userId }, { developerId: userId }] },
        take: 2,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.webDevelopmentProject.findMany({
        where: { OR: [{ pmId: userId }, { developerId: userId }] },
        take: 2,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contentWriterProject.findMany({
        where: { OR: [{ pmId: userId }, { developerId: userId }] },
        take: 2,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const myRecentProjects = [
      ...logoRecentManaged.map(p => ({ ...p, workspace: 'LOGO' })),
      ...webDesignRecentManaged.map(p => ({ ...p, workspace: 'WEB_DESIGN' })),
      ...webDevRecentManaged.map(p => ({ ...p, workspace: 'WEB_DEVELOPMENT' })),
      ...contentRecentManaged.map(p => ({ ...p, workspace: 'CONTENT' })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

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
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
