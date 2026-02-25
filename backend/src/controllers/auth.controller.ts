import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { LoginRequest, AuthResponse } from '../types';
import { generateToken } from '../utils/jwt';

const prisma = new PrismaClient();

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

    // Find user by username (case-insensitive)
    const users = await prisma.user.findMany();
    const user = users.find(u => u.username.toLowerCase() === normalizedUsername);

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
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
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
        email: true,
        role: true,
        name: true,
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
