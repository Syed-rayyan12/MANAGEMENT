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
      message: 'Data retrieved successfully',
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

    // Batched assignment stats
    const [activeAssignments, doneAssignments, revenueByUser] = await Promise.all([
      prisma.projectAssignment.groupBy({
        by: ['userId'],
        _count: { id: true },
        where: { status: 'ACTIVE' },
      }),
      prisma.projectAssignment.groupBy({
        by: ['userId'],
        _count: { id: true },
        where: { status: 'DONE' },
      }),
      prisma.invoice.groupBy({
        by: ['createdById'],
        _sum: { amount: true },
        where: { status: 'PAID' },
      }),
    ]);

    const activeMap = new Map(activeAssignments.map(r => [r.userId, r._count.id]));
    const doneMap = new Map(doneAssignments.map(r => [r.userId, r._count.id]));
    const revenueMap = new Map(revenueByUser.map(r => [r.createdById, Number(r._sum.amount) || 0]));

    const employees = users.map(user => {
      const teams = user.teamMembers.map(m => m.team);
      const stats: Record<string, unknown> = {
        activeProjects: activeMap.get(user.id) || 0,
        completedProjects: doneMap.get(user.id) || 0,
      };

      if (user.role === 'PM' || user.role === 'TL' || user.role === 'EXECUTIVE') {
        stats.totalRevenue = revenueMap.get(user.id) || 0;
      }

      const { teamMembers: _tm, ...userWithoutTeamMembers } = user;
      return { ...userWithoutTeamMembers, teams, stats };
    });

    res.status(200).json({ success: true, message: 'Data retrieved successfully', data: { employees } });
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
        id: true, name: true, username: true, email: true, role: true, specialization: true, avatar: true, createdAt: true,
        teamMembers: { include: { team: { select: { id: true, name: true, slug: true } } } },
      },
    });
    if (!user) { res.status(404).json({ success: false, message: 'Employee not found' }); return; }

    const teams = user.teamMembers.map(m => m.team);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Common assignment stats
    const [activeAssignments, doneAssignments, primaryCount, collaboratorCount, assignmentsByBoard] = await Promise.all([
      prisma.projectAssignment.count({ where: { userId: id, status: 'ACTIVE' } }),
      prisma.projectAssignment.count({ where: { userId: id, status: 'DONE' } }),
      prisma.projectAssignment.count({ where: { userId: id, role: 'PRIMARY' } }),
      prisma.projectAssignment.count({ where: { userId: id, role: 'COLLABORATOR' } }),
      prisma.projectAssignment.findMany({ where: { userId: id }, select: { project: { select: { boardId: true } } } }),
    ]);

    // Group by board
    const boardCounts: Record<string, number> = {};
    for (const a of assignmentsByBoard) { boardCounts[a.project.boardId] = (boardCounts[a.project.boardId] || 0) + 1; }
    const boardIds = Object.keys(boardCounts);
    const boardsInfo = await prisma.board.findMany({ where: { id: { in: boardIds } }, select: { id: true, name: true, slug: true } });
    const projectsByBoard = boardIds.map(bid => {
      const info = boardsInfo.find(b => b.id === bid);
      return { boardId: bid, boardName: info?.name || 'Unknown', boardSlug: info?.slug || '', count: boardCounts[bid] };
    });

    let performance: Record<string, unknown> = {
      activeProjects: activeAssignments, completedProjects: doneAssignments,
      asPrimary: primaryCount, asCollaborator: collaboratorCount, projectsByBoard,
    };

    if (user.role === 'PM' || user.role === 'TL') {
      const [totalRevenueResult, revenueThisMonthResult, invoiceCounts, avgInvoiceResult, distinctClients, newClientsThisMonth] = await Promise.all([
        prisma.invoice.aggregate({ _sum: { amount: true }, where: { createdById: id, status: 'PAID' } }),
        prisma.invoice.aggregate({ _sum: { amount: true }, where: { createdById: id, status: 'PAID', paidAt: { gte: startOfMonth } } }),
        prisma.invoice.groupBy({ by: ['status'], _count: { id: true }, _sum: { amount: true }, where: { createdById: id } }),
        prisma.invoice.aggregate({ _avg: { amount: true }, where: { createdById: id, status: 'PAID' } }),
        prisma.invoice.findMany({ where: { createdById: id }, select: { clientName: true }, distinct: ['clientName'] }),
        prisma.invoice.findMany({ where: { createdById: id, createdAt: { gte: startOfMonth } }, select: { clientName: true }, distinct: ['clientName'] }),
      ]);

      const invoiceBreakdown: Record<string, { count: number; amount: number }> = {};
      let totalInvoicesSent = 0;
      for (const row of invoiceCounts) {
        invoiceBreakdown[row.status] = { count: row._count.id, amount: Number(row._sum.amount) || 0 };
        totalInvoicesSent += row._count.id;
      }

      performance = { ...performance,
        totalRevenue: Number(totalRevenueResult._sum.amount) || 0,
        revenueThisMonth: Number(revenueThisMonthResult._sum.amount) || 0,
        averageInvoiceValue: Number(avgInvoiceResult._avg.amount) || 0,
        totalInvoicesSent, invoiceBreakdown,
        totalClients: distinctClients.length,
        newClientsThisMonth: newClientsThisMonth.length,
      };

      // TL team aggregate
      if (user.role === 'TL') {
        const teamIds = teams.map(t => t.id);
        if (teamIds.length > 0) {
          const teamMemberRecords = await prisma.teamMember.findMany({
            where: { teamId: { in: teamIds } },
            include: { user: { select: { id: true, name: true, role: true, username: true, avatar: true, specialization: true } } },
          });
          const teamUserIds = teamMemberRecords.map(tm => tm.user.id);

          const [teamRevenueResult, teamRevenueThisMonth, teamInvoiceCounts, teamActiveAssignments, teamDoneAssignments] = await Promise.all([
            prisma.invoice.aggregate({ _sum: { amount: true }, where: { createdById: { in: teamUserIds }, status: 'PAID' } }),
            prisma.invoice.aggregate({ _sum: { amount: true }, where: { createdById: { in: teamUserIds }, status: 'PAID', paidAt: { gte: startOfMonth } } }),
            prisma.invoice.groupBy({ by: ['status'], _count: { id: true }, _sum: { amount: true }, where: { createdById: { in: teamUserIds } } }),
            prisma.projectAssignment.groupBy({ by: ['userId'], _count: { id: true }, where: { userId: { in: teamUserIds }, status: 'ACTIVE' } }),
            prisma.projectAssignment.groupBy({ by: ['userId'], _count: { id: true }, where: { userId: { in: teamUserIds }, status: 'DONE' } }),
          ]);

          const perUserRevenue = await prisma.invoice.groupBy({
            by: ['createdById'], _sum: { amount: true },
            where: { createdById: { in: teamUserIds }, status: 'PAID' },
          });
          const userRevenueMap = new Map(perUserRevenue.map(r => [r.createdById, Number(r._sum.amount) || 0]));
          const userActiveMap = new Map(teamActiveAssignments.map(r => [r.userId, r._count.id]));
          const userDoneMap = new Map(teamDoneAssignments.map(r => [r.userId, r._count.id]));

          const teamInvoiceBreakdown: Record<string, { count: number; amount: number }> = {};
          for (const row of teamInvoiceCounts) {
            teamInvoiceBreakdown[row.status] = { count: row._count.id, amount: Number(row._sum.amount) || 0 };
          }

          const teamMembers = teamMemberRecords.map(tm => ({
            ...tm.user, teamId: tm.teamId,
            revenue: userRevenueMap.get(tm.user.id) || 0,
            activeProjects: userActiveMap.get(tm.user.id) || 0,
            completedProjects: userDoneMap.get(tm.user.id) || 0,
          }));

          performance.team = {
            totalRevenue: Number(teamRevenueResult._sum.amount) || 0,
            revenueThisMonth: Number(teamRevenueThisMonth._sum.amount) || 0,
            invoiceBreakdown: teamInvoiceBreakdown,
            activeProjects: teamActiveAssignments.reduce((sum, r) => sum + r._count.id, 0),
            completedProjects: teamDoneAssignments.reduce((sum, r) => sum + r._count.id, 0),
            members: teamMembers,
          };
        }
      }
    } else if (user.role === 'PRODUCTION') {
      const assignedProjectIds = await prisma.projectAssignment.findMany({ where: { userId: id }, select: { projectId: true } });
      const projectIds = assignedProjectIds.map(a => a.projectId);

      const [liveProjects, changesResult] = await Promise.all([
        prisma.project.count({ where: { id: { in: projectIds }, status: 'live' } }),
        prisma.project.aggregate({ _sum: { minorChanges: true, majorChanges: true }, where: { id: { in: projectIds } } }),
      ]);

      const totalMinorChanges = changesResult._sum.minorChanges || 0;
      const totalMajorChanges = changesResult._sum.majorChanges || 0;
      const totalAssigned = projectIds.length;

      performance = { ...performance,
        specialization: user.specialization, liveProjects,
        totalMinorChanges, totalMajorChanges,
        averageChangesPerProject: totalAssigned > 0 ? Math.round((totalMinorChanges + totalMajorChanges) / totalAssigned * 10) / 10 : 0,
        completionRatio: totalAssigned > 0 ? Math.round((doneAssignments / totalAssigned) * 100) : 0,
      };
    }

    const { teamMembers: _tm, ...userInfo } = user;
    res.status(200).json({
      success: true, message: 'Data retrieved successfully',
      data: { performance: { user: { ...userInfo, teams }, role: user.role, ...performance } },
    });
  } catch (error) {
    console.error('Get employee performance error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Admin Teams ────────────────────────────────────

export const getAdminTeams = async (_req: Request, res: Response): Promise<void> => {
  try {
    const teams = await prisma.team.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, message: 'Teams retrieved successfully', data: { teams } });
  } catch (error) {
    console.error('Get admin teams error:', error);
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

    if (user.role === 'EXECUTIVE') {
      const execCount = await prisma.user.count({ where: { role: 'EXECUTIVE' } });
      if (execCount <= 1) {
        res.status(400).json({ success: false, message: 'Cannot delete the last executive account' });
        return;
      }
    }

    // Check if PM has active assignments
    if (user.role === 'PM') {
      const activeAssignments = await prisma.projectAssignment.count({
        where: { userId: id, status: 'ACTIVE' },
      });
      if (activeAssignments > 0) {
        res.status(400).json({
          success: false,
          message: `Cannot delete ${user.name} — they have ${activeAssignments} active project assignments. Remove them from projects first.`,
        });
        return;
      }
    }

    // Delete all assignments for this user
    await prisma.projectAssignment.deleteMany({ where: { userId: id } });

    await prisma.user.delete({ where: { id } });

    res.status(200).json({ success: true, message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
