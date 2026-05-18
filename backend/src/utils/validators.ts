import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// ─── Auth ──────────────────────────────────────────

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').max(100),
  password: z.string().min(1, 'Password is required').max(128),
});

// ─── Projects ──────────────────────────────────────

// Accepts a valid URL, empty string (→ null), null, or undefined
const optionalUrl = z.string()
  .transform(v => v.trim() === '' ? null : v)
  .pipe(z.string().url().nullable())
  .optional()
  .nullable();

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200),
  description: z.string().max(5000).optional().default(''),
  boardId: z.string().min(1, 'Board ID is required'),
  status: z.string().max(50).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  dueDate: z.string().optional().nullable(),
  image: optionalUrl,
  clientId: z.string().uuid().optional().nullable(),
  teamId: z.string().uuid().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  status: z.string().max(50).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  dueDate: z.string().optional().nullable(),
  image: optionalUrl,
  clientId: z.string().uuid().optional().nullable(),
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

// ─── Invoices ──────────────────────────────────────

export const createInvoiceSchema = z.object({
  clientName: z.string().min(1, 'Client name is required').max(200),
  clientEmail: z.string().email('Invalid email').max(254).optional().nullable(),
  description: z.string().min(1, 'Description is required').max(1000),
  amount: z.union([z.string(), z.number()])
    .transform((val) => typeof val === 'string' ? parseFloat(val) : val)
    .refine((val) => !isNaN(val) && val > 0, 'Amount must be a positive number')
    .refine((val) => val <= 999999.99, 'Amount cannot exceed 999,999.99'),
  teamId: z.string().min(1, 'Team ID is required'),
});

// ─── Upload ────────────────────────────────────────

export const presignSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
  fileSize: z.number().positive().max(50 * 1024 * 1024), // 50MB max
  folder: z.string().max(100).optional(),
});

// ─── Admin ─────────────────────────────────────────

export const createEmployeeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email').max(254),
  username: z.string().min(1, 'Username is required').max(100).transform(v => v.toLowerCase().trim()),
  role: z.enum(['PM', 'TL', 'PRODUCTION', 'EXECUTIVE']),
  specialization: z.enum(['LOGO_DESIGNER', 'FIGMA_DESIGNER', 'DEVELOPER', 'CONTENT_WRITER', 'QA']).optional(),
  teamId: z.string().min(1).optional(),
});

// ─── Clients ───────────────────────────────────────

export const createClientSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(200),
  contactEmail: z.string().email('Invalid email').max(254).optional().nullable(),
});

// ─── Assignments ────────────────────────────────────

export const createAssignmentSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: z.enum(['PRIMARY', 'COLLABORATOR']).optional().default('PRIMARY'),
});

export const updateAssignmentSchema = z.object({
  role: z.enum(['PRIMARY', 'COLLABORATOR']).optional(),
  status: z.enum(['ACTIVE', 'DONE']).optional(),
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
