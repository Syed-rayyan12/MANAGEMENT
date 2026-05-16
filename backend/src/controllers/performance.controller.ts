import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getMyPerformance = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, username: true, email: true, role: true, specialization: true, avatar: true, createdAt: true,
        teamMembers: { include: { team: { select: { id: true, name: true, slug: true } } } },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (user.role !== 'PRODUCTION') {
      res.status(403).json({ success: false, message: 'Access denied. This endpoint is only available to PRODUCTION users.' });
      return;
    }

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

    // Get all assignments with project details for turnaround calculation
    const doneAssignmentsDetailed = await prisma.projectAssignment.findMany({
      where: { userId: id, status: 'DONE' },
      include: {
        project: { select: { id: true, name: true, dueDate: true, boardId: true } },
      },
    });

    // Turnaround times (days)
    const turnaroundDays: number[] = [];
    let onTimeCount = 0;
    let lateCount = 0;
    let withDueDateCount = 0;

    for (const a of doneAssignmentsDetailed) {
      if (a.completedAt && a.assignedAt) {
        const days = (a.completedAt.getTime() - a.assignedAt.getTime()) / (1000 * 60 * 60 * 24);
        turnaroundDays.push(Math.round(days * 10) / 10);
      }
      if (a.project.dueDate && a.completedAt) {
        withDueDateCount++;
        if (a.completedAt <= a.project.dueDate) {
          onTimeCount++;
        } else {
          lateCount++;
        }
      }
    }

    const avgTurnaround = turnaroundDays.length > 0
      ? Math.round(turnaroundDays.reduce((s, d) => s + d, 0) / turnaroundDays.length * 10) / 10
      : 0;
    const fastestTurnaround = turnaroundDays.length > 0 ? Math.min(...turnaroundDays) : 0;
    const slowestTurnaround = turnaroundDays.length > 0 ? Math.max(...turnaroundDays) : 0;

    // On-time rate (only projects with a due date)
    const onTimeRate = withDueDateCount > 0 ? Math.round((onTimeCount / withDueDateCount) * 100) : null;

    // Regressions
    const [totalRegressions, regressionsThisMonth] = await Promise.all([
      prisma.regression.count({ where: { userId: id } }),
      prisma.regression.count({ where: { userId: id, createdAt: { gte: startOfMonth } } }),
    ]);

    const totalAssigned = activeAssignments + doneAssignments;
    const regressionRate = totalAssigned > 0 ? Math.round((totalRegressions / totalAssigned) * 100) : 0;

    // Completion trend (last 6 months)
    const monthlyCompletions: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

      const count = await prisma.projectAssignment.count({
        where: {
          userId: id,
          status: 'DONE',
          completedAt: { gte: monthDate, lte: monthEnd },
        },
      });
      monthlyCompletions.push({ month: monthKey, count });
    }

    // Recent completions (last 10)
    const recentCompletions = await prisma.projectAssignment.findMany({
      where: { userId: id, status: 'DONE' },
      orderBy: { completedAt: 'desc' },
      take: 10,
      include: {
        project: {
          select: { id: true, name: true, dueDate: true, board: { select: { name: true, slug: true } } },
        },
      },
    });

    const recentCompletionsList = recentCompletions.map(a => ({
      projectId: a.project.id,
      projectName: a.project.name,
      board: a.project.board.name,
      boardSlug: a.project.board.slug,
      assignedAt: a.assignedAt,
      completedAt: a.completedAt,
      turnaroundDays: a.completedAt && a.assignedAt
        ? Math.round((a.completedAt.getTime() - a.assignedAt.getTime()) / (1000 * 60 * 60 * 24) * 10) / 10
        : null,
      onTime: a.project.dueDate && a.completedAt ? a.completedAt <= a.project.dueDate : null,
    }));

    // Recent regressions (last 10)
    const recentRegressions = await prisma.regression.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        project: { select: { id: true, name: true } },
        causedBy: { select: { id: true, name: true } },
      },
    });

    const regressionsList = recentRegressions.map(r => ({
      projectId: r.project.id,
      projectName: r.project.name,
      causedBy: r.causedBy.name,
      fromColumn: r.fromColumn,
      toColumn: r.toColumn,
      createdAt: r.createdAt,
    }));

    const teams = user.teamMembers.map(m => m.team);
    const { teamMembers: _tm, ...userInfo } = user;

    const performance = {
      activeProjects: activeAssignments,
      completedProjects: doneAssignments,
      asPrimary: primaryCount,
      asCollaborator: collaboratorCount,
      projectsByBoard,
      specialization: user.specialization,
      avgTurnaround,
      fastestTurnaround,
      slowestTurnaround,
      onTimeRate,
      onTimeCount,
      lateCount,
      withDueDateCount,
      totalRegressions,
      regressionsThisMonth,
      regressionRate,
      completionTrend: monthlyCompletions,
      recentCompletions: recentCompletionsList,
      recentRegressions: regressionsList,
    };

    res.status(200).json({
      success: true,
      message: 'Performance data retrieved',
      data: { performance: { user: { ...userInfo, teams }, role: user.role, ...performance } },
    });
  } catch (error) {
    console.error('Get my performance error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
