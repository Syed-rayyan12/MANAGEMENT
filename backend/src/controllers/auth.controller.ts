import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { LoginRequest, AuthResponse } from '../types';
import { generateToken } from '../utils/jwt';
import prisma from '../lib/prisma';

/**
 * Login user
 * POST /api/auth/login
 */
export const login = async (
  req: Request<{}, {}, LoginRequest>,
  res: Response<AuthResponse>
): Promise<void> => {
  try {
    const { username, password } = req.body;

    // Validate required fields
    if (!username || !password) {
      res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
      return;
    }

    // Normalize username: remove spaces and convert to lowercase
    const normalizedUsername = username.replace(/\s+/g, '').toLowerCase();

    // Find user by username (case-insensitive, efficient single-row query)
    const user = await prisma.user.findFirst({
      where: {
        username: {
          equals: normalizedUsername,
          mode: 'insensitive',
        },
      },
      include: {
        teamMembers: {
          include: {
            team: { select: { id: true, slug: true, name: true } },
          },
        },
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
      return;
    }

    // Generate token
    const teamIds = user.teamMembers.map(tm => tm.team.id);
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      teamIds,
    });

    const teams = user.teamMembers.map(tm => ({
      id: tm.team.id,
      slug: tm.team.slug,
      name: tm.team.name,
    }));

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          name: user.name,
          avatar: user.avatar,
          specialization: user.specialization,
          teams,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Get current user profile
 * GET /api/auth/me
 */
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        name: true,
        avatar: true,
        specialization: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'User profile retrieved successfully',
      data: { user },
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Verify the current user's password
 * POST /api/auth/verify-password
 */
export const verifyPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { password } = req.body;

    if (!password) {
      res.status(400).json({ success: false, message: 'Password is required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.status(401).json({ success: false, message: 'Invalid password' });
      return;
    }

    res.status(200).json({ success: true, message: 'Password verified' });
  } catch (error) {
    console.error('Verify password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Update current user's own profile
 * PATCH /api/auth/me
 */
export const updateMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const { name, email, specialization, avatar } = req.body;

    // Email is unique — check for conflicts before updating
    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email, NOT: { id: req.user.id } },
        select: { id: true },
      });
      if (existing) {
        res.status(409).json({ success: false, message: 'Email already in use' });
        return;
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(specialization !== undefined && { specialization }),
        ...(avatar !== undefined && { avatar }),
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        name: true,
        avatar: true,
        specialization: true,
        createdAt: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Change current user's password
 * POST /api/auth/change-password
 *
 * NOTE: wrong current password returns 400, NOT 401 — the frontend
 * apiFetch interceptor treats 401 as an expired session and force-logs
 * the user out, which must not happen on a typo'd password.
 */
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      res.status(400).json({ success: false, message: 'Current password is incorrect' });
      return;
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
