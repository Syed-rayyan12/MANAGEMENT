import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { emitToUser } from '../socket/emitHelper';

// ─── Helper: Create notification(s) ────────────────

export async function createNotification(data: {
  type: string;
  message: string;
  userId: string;   // recipient
  projectId?: string;
  actorId?: string;  // who triggered it
}) {
  const notification = await prisma.notification.create({ data });

  // Push to recipient via WebSocket
  emitToUser(data.userId, 'notification:new', {
    id: notification.id,
    userId: data.userId,
    type: data.type,
    message: data.message,
    projectId: data.projectId || '',
    read: false,
    timestamp: notification.createdAt.toISOString(),
  });

  return notification;
}

export async function createManyNotifications(items: {
  type: string;
  message: string;
  userId: string;
  projectId?: string;
  actorId?: string;
}[]) {
  if (items.length === 0) return;

  // Create individually so we get real IDs for socket push
  for (const item of items) {
    const notification = await prisma.notification.create({ data: item });
    emitToUser(item.userId, 'notification:new', {
      id: notification.id,
      userId: item.userId,
      type: item.type,
      message: item.message,
      projectId: item.projectId || '',
      read: false,
      timestamp: notification.createdAt.toISOString(),
    });
  }
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

    // Get DONE-phase column keys to exclude completed projects
    const doneColumns = await prisma.boardColumn.findMany({
      where: { phase: 'DONE', deletedAt: null },
      select: { key: true },
    });
    const doneKeys = doneColumns.map(c => c.key);

    // Find overdue or due-soon projects where user is assigned
    const dueSoonProjects = await prisma.project.findMany({
      where: {
        deletedAt: null,
        status: { notIn: doneKeys },
        dueDate: { lte: threeDaysFromNow },
        id: { in: assignedProjectIds },
      },
      select: { id: true, name: true, dueDate: true },
    });

    if (dueSoonProjects.length > 0) {
      // Batch check: which projects already have a due_date notification today?
      const dueSoonIds = dueSoonProjects.map(p => p.id);
      const existingNotifs = await prisma.notification.findMany({
        where: {
          userId: req.user.id,
          projectId: { in: dueSoonIds },
          type: 'due_date',
          createdAt: { gte: oneDayAgo },
        },
        select: { projectId: true },
      });
      const alreadyNotified = new Set(existingNotifs.map(n => n.projectId));

      // Build notifications for projects that don't have one yet
      const newNotifs = dueSoonProjects
        .filter(p => p.dueDate && !alreadyNotified.has(p.id))
        .map(p => {
          const isOverdue = p.dueDate! < now;
          return {
            type: 'due_date',
            message: isOverdue
              ? `⏰ ${p.name} is overdue (was due ${p.dueDate!.toLocaleDateString()})`
              : `⏳ ${p.name} is due soon — ${p.dueDate!.toLocaleDateString()}`,
            userId: req.user!.id,
            projectId: p.id,
          };
        });

      if (newNotifs.length > 0) {
        await prisma.notification.createMany({ data: newNotifs });
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
