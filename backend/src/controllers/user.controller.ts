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
        workspace: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: { users },
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
        workspace: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: { users },
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
        workspace: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Assign a workspace to a user (PM only)
 * PATCH /api/users/:id/workspace
 */
export const updateUserWorkspace = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'PM') {
      res.status(403).json({ success: false, message: 'Only PMs can assign team workspaces' });
      return;
    }

    const { workspace } = req.body;
    const validWorkspaces = ['LOGO', 'WEB_DESIGN', 'WEB_DEVELOPMENT', 'CONTENT', null];
    if (!validWorkspaces.includes(workspace)) {
      res.status(400).json({ success: false, message: 'Invalid workspace value' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { workspace: workspace ?? null },
      select: { id: true, name: true, role: true, workspace: true },
    });

    res.status(200).json({ success: true, message: 'Workspace assigned', data: { user } });
  } catch (error) {
    console.error('Update user workspace error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
