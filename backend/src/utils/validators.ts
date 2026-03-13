import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// ─── Auth ──────────────────────────────────────────

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').max(100),
  password: z.string().min(1, 'Password is required').max(128),
});

// ─── Projects ──────────────────────────────────────

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200),
  description: z.string().max(5000).optional().default(''),
  boardId: z.string().min(1, 'Board ID is required'),
  status: z.string().max(50).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  dueDate: z.string().optional().nullable(),
  developerId: z.string().optional().nullable(),
  image: z.string().url().optional().nullable(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  status: z.string().max(50).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  dueDate: z.string().optional().nullable(),
  developerId: z.string().uuid().optional().nullable(),
  image: z.string().url().optional().nullable(),
});

// ─── Comments ──────────────────────────────────────

export const addCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(5000),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(5000),
});

// ─── Labels ────────────────────────────────────────

export const addLabelSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a valid hex color'),
});

// ─── Attachments ───────────────────────────────────

export const addAttachmentSchema = z.object({
  filename: z.string().min(1).max(255),
  url: z.string().url(),
  key: z.string().optional(),
  type: z.string().max(100),
  size: z.number().positive().optional(),
});

// ─── Checklist ─────────────────────────────────────

export const updateChecklistSchema = z.object({
  items: z.array(z.object({
    title: z.string().min(1).max(500),
    completed: z.boolean(),
    position: z.number().int().min(0),
  })),
});

// ─── Upload ────────────────────────────────────────

export const presignSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
  fileSize: z.number().positive().max(50 * 1024 * 1024), // 50MB max
  folder: z.string().max(100).optional(),
});

// ─── Middleware factory ────────────────────────────

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
