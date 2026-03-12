import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get teams the current user belongs to (or all teams for EXECUTIVE/TL).
 * GET /api/teams/my-teams
 */
export const getMyTeams = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // EXECUTIVE sees all teams
    if (req.user.role === 'EXECUTIVE') {
      const teams = await prisma.team.findMany({
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
              columns: { orderBy: { position: 'asc' } },
            },
          },
          _count: { select: { members: true } },
        },
        orderBy: { name: 'asc' },
      });

      res.status(200).json({ success: true, data: { teams } });
      return;
    }

    // PRODUCTION sees all teams (they may have tasks from any team)
    if (req.user.role === 'PRODUCTION') {
      const teams = await prisma.team.findMany({
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
              columns: { orderBy: { position: 'asc' } },
            },
          },
          _count: { select: { members: true } },
        },
        orderBy: { name: 'asc' },
      });

      res.status(200).json({ success: true, data: { teams } });
      return;
    }

    // TL/PM — only teams they belong to
    const memberships = await prisma.teamMember.findMany({
      where: { userId: req.user.id },
      include: {
        team: {
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                columns: { orderBy: { position: 'asc' } },
              },
            },
            _count: { select: { members: true } },
          },
        },
      },
    });

    const teams = memberships.map(m => m.team);

    res.status(200).json({ success: true, data: { teams } });
  } catch (error) {
    console.error('Get my teams error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get team by slug
 * GET /api/teams/:slug
 */
export const getTeamBySlug = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;

    const team = await prisma.team.findUnique({
      where: { slug },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            columns: { orderBy: { position: 'asc' } },
          },
        },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true, avatar: true } },
          },
        },
        _count: { select: { members: true } },
      },
    });

    if (!team) {
      res.status(404).json({ success: false, message: 'Team not found' });
      return;
    }

    res.status(200).json({ success: true, data: { team } });
  } catch (error) {
    console.error('Get team by slug error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get workspace columns for a workspace
 * GET /api/teams/workspace/:workspaceId/columns
 */
export const getWorkspaceColumns = async (req: Request, res: Response): Promise<void> => {
  try {
    const { workspaceId } = req.params;

    const columns = await prisma.workspaceColumn.findMany({
      where: { workspaceId },
      orderBy: { position: 'asc' },
    });

    res.status(200).json({ success: true, data: { columns } });
  } catch (error) {
    console.error('Get workspace columns error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
