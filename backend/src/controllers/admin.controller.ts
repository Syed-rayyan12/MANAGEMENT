import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';

// ─── KPIs ───────────────────────────────────────────

export const getKPIs = async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalRevenueAllTimeResult,
      totalRevenueThisMonthResult,
      totalProjects,
      activeProjects,
      completedProjects,
      liveProjects,
      projectsByBoard,
      revenueByTeam,
      newClientsThisMonth,
    ] = await Promise.all([
      prisma.invoice.aggregate({
        _sum: { amount: true },
        where: { status: 'PAID' },
      }),
      prisma.invoice.aggregate({
        _sum: { amount: true },
        where: { status: 'PAID', paidAt: { gte: startOfMonth } },
      }),
      prisma.project.count(),
      prisma.project.count({ where: { status: { notIn: ['completed', 'live'] } } }),
      prisma.project.count({ where: { status: 'completed' } }),
      prisma.project.count({ where: { status: 'live' } }),
      prisma.board.findMany({
        include: { _count: { select: { projects: true } } },
      }),
      prisma.team.findMany({
        include: {
          invoices: {
            where: { status: 'PAID' },
            select: { amount: true },
          },
        },
      }),
      prisma.client.count({ where: { createdAt: { gte: startOfMonth } } }),
    ]);

    const totalRevenueAllTime = Number(totalRevenueAllTimeResult._sum.amount) || 0;
    const totalRevenueThisMonth = Number(totalRevenueThisMonthResult._sum.amount) || 0;

    const revenueByTeamMapped = revenueByTeam.map((team) => ({
      id: team.id,
      name: team.name,
      slug: team.slug,
      totalRevenue: team.invoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0),
    }));

    res.status(200).json({
      success: true,
      data: {
        kpis: {
          totalRevenueAllTime,
          totalRevenueThisMonth,
          totalProjects,
          activeProjects,
          completedProjects,
          liveProjects,
          projectsByBoard,
          revenueByTeam: revenueByTeamMapped,
          newClientsThisMonth,
        },
      },
    });
  } catch (error) {
    console.error('Get KPIs error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Employees ─────────────────────────────────────

export const getEmployees = async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        specialization: true,
        avatar: true,
        createdAt: true,
        teamMembers: {
          include: {
            team: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const employees = await Promise.all(
      users.map(async (user) => {
        const teams = user.teamMembers.map((m) => m.team);
        let stats: Record<string, unknown> = {};

        if (user.role === 'PM') {
          const [activeProjects, completedProjects, revenueResult] = await Promise.all([
            prisma.project.count({
              where: { pmId: user.id, status: { notIn: ['completed', 'live'] } },
            }),
            prisma.project.count({
              where: { pmId: user.id, status: 'completed' },
            }),
            prisma.invoice.aggregate({
              _sum: { amount: true },
              where: { createdById: user.id, status: 'PAID' },
            }),
          ]);
          stats = {
            activeProjects,
            completedProjects,
            totalRevenue: Number(revenueResult._sum.amount) || 0,
          };
        } else if (user.role === 'TL') {
          const teamIds = teams.map((t) => t.id);
          const teamMembersCount = teamIds.length > 0
            ? await prisma.teamMember.count({ where: { teamId: { in: teamIds } } })
            : 0;
          stats = { teamMembersCount };
        } else if (user.role === 'PRODUCTION') {
          const [activeProjects, completedProjects] = await Promise.all([
            prisma.project.count({
              where: { developerId: user.id, status: { notIn: ['completed', 'live'] } },
            }),
            prisma.project.count({
              where: { developerId: user.id, status: 'completed' },
            }),
          ]);
          stats = { activeProjects, completedProjects };
        }

        const { teamMembers: _tm, ...userWithoutTeamMembers } = user;
        return { ...userWithoutTeamMembers, teams, stats };
      })
    );

    res.status(200).json({ success: true, data: { employees } });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Employee Performance ───────────────────────────

export const getEmployeePerformance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        specialization: true,
        avatar: true,
        createdAt: true,
        teamMembers: {
          include: {
            team: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'Employee not found' });
      return;
    }

    const teams = user.teamMembers.map((m) => m.team);
    let performance: Record<string, unknown> = {};

    if (user.role === 'PM') {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        activeProjects,
        completedProjects,
        totalRevenueResult,
        revenueThisMonthResult,
        recentProjects,
        projectsByBoardRaw,
      ] = await Promise.all([
        prisma.project.count({
          where: { pmId: user.id, status: { notIn: ['completed', 'live'] } },
        }),
        prisma.project.count({
          where: { pmId: user.id, status: 'completed' },
        }),
        prisma.invoice.aggregate({
          _sum: { amount: true },
          where: { createdById: user.id, status: 'PAID' },
        }),
        prisma.invoice.aggregate({
          _sum: { amount: true },
          where: { createdById: user.id, status: 'PAID', paidAt: { gte: startOfMonth } },
        }),
        prisma.project.findMany({
          where: { pmId: user.id },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { board: { select: { name: true, slug: true } } },
        }),
        prisma.project.groupBy({
          by: ['boardId'],
          where: { pmId: user.id },
          _count: { id: true },
        }),
      ]);

      const boardIds = projectsByBoardRaw.map((g) => g.boardId);
      const boards = await prisma.board.findMany({
        where: { id: { in: boardIds } },
        select: { id: true, name: true, slug: true },
      });

      const projectsByBoard = projectsByBoardRaw.map((g) => {
        const board = boards.find((b) => b.id === g.boardId);
        return {
          boardId: g.boardId,
          boardName: board?.name || 'Unknown',
          boardSlug: board?.slug || '',
          count: g._count.id,
        };
      });

      performance = {
        activeProjects,
        completedProjects,
        totalRevenue: Number(totalRevenueResult._sum.amount) || 0,
        revenueThisMonth: Number(revenueThisMonthResult._sum.amount) || 0,
        projectsByBoard,
        recentProjects,
      };
    } else if (user.role === 'TL') {
      const teamIds = teams.map((t) => t.id);

      const [teamMembersCount, teamActiveProjects, teamCompletedProjects, teamRevenueResult] =
        await Promise.all([
          teamIds.length > 0
            ? prisma.teamMember.count({ where: { teamId: { in: teamIds } } })
            : Promise.resolve(0),
          teamIds.length > 0
            ? prisma.project.count({
                where: { teamId: { in: teamIds }, status: { notIn: ['completed', 'live'] } },
              })
            : Promise.resolve(0),
          teamIds.length > 0
            ? prisma.project.count({
                where: { teamId: { in: teamIds }, status: 'completed' },
              })
            : Promise.resolve(0),
          teamIds.length > 0
            ? prisma.invoice.aggregate({
                _sum: { amount: true },
                where: { teamId: { in: teamIds }, status: 'PAID' },
              })
            : Promise.resolve({ _sum: { amount: null } }),
        ]);

      // Get team members with basic stats
      const teamMemberUsers = teamIds.length > 0
        ? await prisma.teamMember.findMany({
            where: { teamId: { in: teamIds } },
            include: {
              user: { select: { id: true, name: true, role: true, username: true, avatar: true } },
            },
          })
        : [];

      performance = {
        teamMembersCount,
        teamActiveProjects,
        teamCompletedProjects,
        teamRevenue: Number(teamRevenueResult._sum.amount) || 0,
        teamMembers: teamMemberUsers.map((tm) => ({
          ...tm.user,
          teamId: tm.teamId,
        })),
      };
    } else if (user.role === 'PRODUCTION') {
      const [
        activeProjects,
        completedProjects,
        liveProjects,
        projectsByBoardRaw,
        changesResult,
      ] = await Promise.all([
        prisma.project.count({
          where: { developerId: user.id, status: { notIn: ['completed', 'live'] } },
        }),
        prisma.project.count({
          where: { developerId: user.id, status: 'completed' },
        }),
        prisma.project.count({
          where: { developerId: user.id, status: 'live' },
        }),
        prisma.project.groupBy({
          by: ['boardId'],
          where: { developerId: user.id },
          _count: { id: true },
        }),
        prisma.project.aggregate({
          _sum: { minorChanges: true, majorChanges: true },
          where: { developerId: user.id },
        }),
      ]);

      const boardIds = projectsByBoardRaw.map((g) => g.boardId);
      const boards = await prisma.board.findMany({
        where: { id: { in: boardIds } },
        select: { id: true, name: true, slug: true },
      });

      const projectsByBoard = projectsByBoardRaw.map((g) => {
        const board = boards.find((b) => b.id === g.boardId);
        return {
          boardId: g.boardId,
          boardName: board?.name || 'Unknown',
          boardSlug: board?.slug || '',
          count: g._count.id,
        };
      });

      performance = {
        specialization: user.specialization,
        activeProjects,
        completedProjects,
        liveProjects,
        projectsByBoard,
        totalMinorChanges: changesResult._sum.minorChanges || 0,
        totalMajorChanges: changesResult._sum.majorChanges || 0,
      };
    } else {
      // EXECUTIVE — basic info only
      performance = {
        role: user.role,
        teams,
      };
    }

    const { teamMembers: _tm, ...userInfo } = user;
    res.status(200).json({
      success: true,
      data: {
        performance: {
          user: { ...userInfo, teams },
          ...performance,
        },
      },
    });
  } catch (error) {
    console.error('Get employee performance error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Create Employee ────────────────────────────────

export const createEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, username, role, specialization, teamId } = req.body;

    // Check username uniqueness
    const existingByUsername = await prisma.user.findUnique({ where: { username } });
    if (existingByUsername) {
      res.status(409).json({ success: false, message: 'Username already taken' });
      return;
    }

    // Check email uniqueness
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) {
      res.status(409).json({ success: false, message: 'Email already in use' });
      return;
    }

    const hashedPassword = await bcrypt.hash('password123', 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        username,
        password: hashedPassword,
        role,
        specialization: specialization || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        specialization: true,
        avatar: true,
        createdAt: true,
      },
    });

    // Add to team if teamId is provided and role warrants it
    if (teamId && (role === 'PM' || role === 'TL')) {
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (team) {
        await prisma.teamMember.create({
          data: { userId: newUser.id, teamId },
        });
      }
    }

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: { employee: newUser },
    });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Delete Employee ────────────────────────────────

export const deleteEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (id === req.user?.id) {
      res.status(400).json({ success: false, message: 'You cannot delete your own account' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ success: false, message: 'Employee not found' });
      return;
    }

    if (user.role === 'PM') {
      const projectCount = await prisma.project.count({ where: { pmId: id } });
      if (projectCount > 0) {
        res.status(400).json({
          success: false,
          message: 'Cannot delete PM with active projects. Reassign projects first.',
        });
        return;
      }
    }

    if (user.role === 'PRODUCTION') {
      await prisma.project.updateMany({
        where: { developerId: id },
        data: { developerId: null },
      });
    }

    await prisma.user.delete({ where: { id } });

    res.status(200).json({ success: true, message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
