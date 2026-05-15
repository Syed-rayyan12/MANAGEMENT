import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// ─── Helper: Create notification(s) ────────────────

export async function createNotification(data: {
  type: string;
  message: string;
  userId: string;   // recipient
  projectId?: string;
  actorId?: string;  // who triggered it
}) {
  return prisma.notification.create({ data });
}

export async function createManyNotifications(items: {
  type: string;
  message: string;
  userId: string;
  projectId?: string;
  actorId?: string;
}[]) {
  if (items.length === 0) return;
  return prisma.notification.createMany({ data: items });
}

// ─── Get notifications for current user ─────────────

export const getMyNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // ── Generate due-date reminders on-the-fly (once per task per day) ──
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Find projects the user is assigned to
    const userAssignments = await prisma.projectAssignment.findMany({
      where: { userId: req.user.id },
      select: { projectId: true },
    });
    const assignedProjectIds = userAssignments.map(a => a.projectId);

    // Find overdue or due-soon projects where user is assigned
    const dueSoonProjects = await prisma.project.findMany({
      where: {
        status: { notIn: ['completed', 'revisions'] },
        dueDate: { lte: threeDaysFromNow },
        id: { in: assignedProjectIds },
      },
      select: { id: true, name: true, dueDate: true },
    });

    for (const p of dueSoonProjects) {
      if (!p.dueDate) continue;
      const isOverdue = p.dueDate < now;
      const type = 'due_date';
      // Check if we already sent a due_date notification for this project today
      const existing = await prisma.notification.findFirst({
        where: {
          userId: req.user.id,
          projectId: p.id,
          type,
          createdAt: { gte: oneDayAgo },
        },
      });
      if (!existing) {
        await prisma.notification.create({
          data: {
            type,
            message: isOverdue
              ? `⏰ ${p.name} is overdue (was due ${p.dueDate.toLocaleDateString()})`
              : `⏳ ${p.name} is due soon — ${p.dueDate.toLocaleDateString()}`,
            userId: req.user.id,
            projectId: p.id,
          },
        });
      }
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });

    res.status(200).json({ success: true, data: { notifications } });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Get unread count ───────────────────────────────

export const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const count = await prisma.notification.count({
      where: { userId: req.user.id, read: false },
    });

    res.status(200).json({ success: true, data: { count } });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Mark single notification read ──────────────────

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    res.status(200).json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Mark all notifications read ────────────────────

export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    await prisma.notification.updateMany({
      where: { userId: req.user.id, read: false },
      data: { read: true },
    });

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
