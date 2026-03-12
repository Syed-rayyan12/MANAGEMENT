import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get teams the current user belongs to.
 * GET /api/teams/my-teams
 */
export const getMyTeams = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // EXECUTIVE/PRODUCTION see all teams
    if (req.user.role === 'EXECUTIVE' || req.user.role === 'PRODUCTION') {
      const teams = await prisma.team.findMany({
        include: { _count: { select: { members: true } } },
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
          include: { _count: { select: { members: true } } },
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
