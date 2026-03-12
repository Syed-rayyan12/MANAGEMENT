import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get all users (excluding passwords)
 * GET /api/users
 */
export const getAllUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        createdAt: true,
        teamMembers: {
          include: { team: { select: { id: true, slug: true, name: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Flatten team info
    const mapped = users.map(u => ({
      ...u,
      teams: u.teamMembers.map(tm => tm.team),
      teamMembers: undefined,
    }));

    res.status(200).json({
      success: true,
      data: { users: mapped },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get users filtered by role
 * GET /api/users/role/:role
 */
export const getUsersByRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role } = req.params;
    const validRoles = ['PM', 'TL', 'EXECUTIVE', 'PRODUCTION'];

    if (!validRoles.includes(role.toUpperCase())) {
      res.status(400).json({ success: false, message: 'Invalid role' });
      return;
    }

    const users = await prisma.user.findMany({
      where: { role: role.toUpperCase() as any },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        createdAt: true,
        teamMembers: {
          include: { team: { select: { id: true, slug: true, name: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });

    const mapped = users.map(u => ({
      ...u,
      teams: u.teamMembers.map(tm => tm.team),
      teamMembers: undefined,
    }));

    res.status(200).json({
      success: true,
      data: { users: mapped },
    });
  } catch (error) {
    console.error('Get users by role error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get a single user by ID
 * GET /api/users/:id
 */
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        createdAt: true,
        teamMembers: {
          include: { team: { select: { id: true, slug: true, name: true } } },
        },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const mapped = {
      ...user,
      teams: user.teamMembers.map(tm => tm.team),
      teamMembers: undefined,
    };

    res.status(200).json({ success: true, data: { user: mapped } });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
