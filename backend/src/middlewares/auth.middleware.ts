import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { UserPayload } from '../types';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided. Authorization header must be in format: Bearer <token>',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = verifyToken(token);
      req.user = decoded;
      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
      return;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
    return;
  }
};

// Middleware to check if user has specific role
export const authorizeRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(', ')}`,
      });
      return;
    }

    next();
  };
};
