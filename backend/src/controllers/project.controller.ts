import { Request, Response } from 'express';
import { createManyNotifications } from './notification.controller';
import prisma from '../lib/prisma';
import { format } from 'date-fns';
import {
  appendProjectRow,
  findRowByCrmId,
  updateCell,
  getCellValue,
  incrementCell,
  getBoardRole,
  SHEET_COLUMNS,
} from '../utils/googleSheets';

// Shared include for loading project relations
const projectIncludes = {
  assignments: {
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true, role: true, specialization: true } },
    },
    orderBy: { assignedAt: 'asc' as const },
  },
  comments: {
    include: { user: { select: { id: true, name: true, avatar: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  checklist: { orderBy: { position: 'asc' as const } },
  labels: { include: { label: true } },
  attachments: { orderBy: { uploadedAt: 'desc' as const } },
  activities: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' as const },
    take: 20,
  },
  board: { select: { id: true, name: true, slug: true } },
  team: { select: { id: true, name: true, slug: true } },
  client: { select: { id: true, name: true, contactEmail: true } },
};

/**
 * Build WHERE clause for project visibility.
 * All authenticated users can see all projects across all teams.
 */
function buildWhereClause(user: Request['user']): Record<string, unknown> {
  if (!user) return { id: 'none' };
  return { deletedAt: null };
}

// ─── Get projects by board ──────────────────────────

export const getBoardProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const { boardId } = req.params;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Verify board exists
    const board = await prisma.board.findFirst({ where: { id: boardId, deletedAt: null } });
    if (!board) {
      res.status(404).json({ success: false, message: 'Board not found' });
      return;
    }

    // Build team-scoped WHERE + board filter
    const teamWhere = buildWhereClause(req.user);
    const where: any = { ...teamWhere, boardId };

    const projects = await prisma.project.findMany({
      where,
      include: projectIncludes,
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    });

    res.status(200).json({
      success: true,
      message: `Projects retrieved for board: ${board.name}`,
      data: { projects },
    });
  } catch (error) {
    console.error('Get board projects error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Get all projects (scoped to user) ──────────────

export const getAllProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const where = buildWhereClause(req.user);
    const projects = await prisma.project.findMany({
      where,
      include: projectIncludes,
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    });

    res.status(200).json({
      success: true,
      message: 'All projects retrieved successfully',
      data: { projects },
    });
  } catch (error) {
    console.error('Get all projects error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Create project ────────────────────────────────

export const createProject = async (req: Request, res: Response): Promise<void> => {
  try {
    let { name, boardId, description, priority, dueDate, image, status, clientId } = req.body;

    const creatorId = req.user?.id;
    if (!name || !boardId || !creatorId) {
      res.status(400).json({ success: false, message: 'Name and boardId are required' });
      return;
    }

    // Resolve board: accept either UUID or slug
    let board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) {
      board = await prisma.board.findUnique({ where: { slug: boardId } });
    }
    if (!board) {
      res.status(404).json({ success: false, message: 'Board not found' });
      return;
    }
    boardId = board.id;

    // Determine teamId from the creator's team membership
    const creatorMemberships = await prisma.teamMember.findMany({
      where: { userId: creatorId },
      select: { teamId: true },
    });
    if (creatorMemberships.length === 0) {
      res.status(400).json({ success: false, message: 'You must belong to a team to create projects' });
      return;
    }
    const teamId = creatorMemberships[0].teamId;

    // Validate status against board columns if provided
    if (status) {
      const column = await prisma.boardColumn.findUnique({
        where: { boardId_key: { boardId, key: status } },
      });
      if (!column) {
        res.status(400).json({ success: false, message: `Invalid status "${status}" for this board` });
        return;
      }
    }

    // Create project (no pmId/developerId)
    const project = await prisma.project.create({
      data: {
        name,
        boardId,
        teamId,
        description,
        status: status || 'todo',
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        image: image || null,
        clientId: clientId || null,
      },
      include: projectIncludes,
    });

    // Auto-assign creator as first member (PRIMARY)
    await prisma.projectAssignment.create({
      data: { projectId: project.id, userId: creatorId, role: 'PRIMARY' },
    });

    // Re-fetch to include the new assignment
    const fullProject = await prisma.project.findUnique({
      where: { id: project.id },
      include: projectIncludes,
    });

    // Log activity
    await prisma.activityLog.create({
      data: { action: `Created project: ${name}`, projectId: project.id, userId: creatorId },
    });

    // Notify all PRODUCTION users about the new project
    const creatorUser = await prisma.user.findUnique({ where: { id: creatorId }, select: { name: true } });
    const productionUsers = await prisma.user.findMany({
      where: { role: 'PRODUCTION' },
      select: { id: true },
    });
    const prodNotifItems = productionUsers
      .filter(u => u.id !== creatorId)
      .map(u => ({
        type: 'project_created',
        message: `${creatorUser?.name || 'Someone'} created a new project: ${name}`,
        userId: u.id,
        projectId: project.id,
        actorId: creatorId,
      }));
    await createManyNotifications(prodNotifItems);

    // Google Sheets sync (fire-and-forget)
    (async () => {
      try {
        const initialColumn = await prisma.boardColumn.findFirst({
          where: { boardId, key: fullProject?.status || 'todo' },
          select: { name: true },
        });
        await appendProjectRow({
          projectName: name,
          pmName: creatorUser?.name || '',
          assignedTo: '',
          role: getBoardRole(board!.name),
          taskType: board!.name,
          dateAssigned: format(project.createdAt, 'MM/dd/yyyy'),
          eta: project.dueDate ? format(new Date(project.dueDate), 'MM/dd/yyyy') : '',
          status: initialColumn?.name || 'To Do',
          crmId: project.id,
        });
      } catch (err) {
        console.error('[GoogleSheets] createProject sync failed:', err);
      }
    })();

    res.status(201).json({
      success: true,
      message: 'Project created',
      data: { project: fullProject },
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Get project by ID ─────────────────────────────

export const getProjectById = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: projectIncludes,
    });

    if (!project) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }

    res.status(200).json({ success: true, data: { project } });
  } catch (error) {
    console.error('Get project by ID error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Update project ────────────────────────────────

export const updateProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existing = await prisma.project.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }

    // Validate status if provided
    if (updateData.status) {
      // Validate against board columns
      const project_board = await prisma.project.findUnique({
        where: { id },
        select: { boardId: true },
      });
      if (project_board) {
        const column = await prisma.boardColumn.findUnique({
          where: { boardId_key: { boardId: project_board.boardId, key: updateData.status } },
        });
        if (!column) {
          res.status(400).json({ success: false, message: `Invalid status "${updateData.status}" for this board` });
          return;
        }
      }
    }

    // Validate priority
    if (updateData.priority) {
      const valid = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      if (!valid.includes(updateData.priority)) {
        res.status(400).json({ success: false, message: 'Invalid priority' });
        return;
      }
    }

    // Strip legacy pmId/developerId if they come through
    delete updateData.pmId;
    delete updateData.developerId;

    // Extract changeType before Prisma update — it's a transient trigger, not a DB field
    const changeType: string | undefined = updateData.changeType;
    delete updateData.changeType;

    const finalData = {
      ...updateData,
      dueDate: updateData.dueDate ? new Date(updateData.dueDate) : undefined,
    };

    const project = await prisma.project.update({
      where: { id },
      data: finalData,
      include: projectIncludes,
    });

    // Log activity
    if (req.user) {
      await prisma.activityLog.create({
        data: { action: 'Updated project', projectId: id, userId: req.user.id, details: updateData },
      });

      const actorName = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } }))?.name || 'Someone';

      // Notify assigned members on status change
      if (updateData.status && updateData.status !== existing.status) {
        const assignedUserIds = await prisma.projectAssignment.findMany({
          where: { projectId: id },
          select: { userId: true },
        });
        const recipients = assignedUserIds
          .map(a => a.userId)
          .filter(uid => uid !== req.user!.id);

        const isCompleted = updateData.status === 'completed';
        const statusItems = recipients.map((uid) => ({
          type: isCompleted ? 'completed' : 'status',
          message: isCompleted
            ? `${actorName} marked ${existing.name} as completed! 🎉`
            : `${actorName} moved ${existing.name} to ${updateData.status}`,
          userId: uid,
          projectId: id,
          actorId: req.user!.id,
        }));
        await createManyNotifications(statusItems);
      }

      // Notify assigned members when priority escalated to CRITICAL
      if (updateData.priority && updateData.priority !== existing.priority && updateData.priority === 'CRITICAL') {
        const assignedUserIds = await prisma.projectAssignment.findMany({
          where: { projectId: id },
          select: { userId: true },
        });
        const criticalItems = assignedUserIds
          .map(a => a.userId)
          .filter(uid => uid !== req.user!.id)
          .map(uid => ({
            type: 'priority',
            message: `⚠️ ${actorName} escalated ${existing.name} to CRITICAL priority`,
            userId: uid,
            projectId: id,
            actorId: req.user!.id,
          }));
        await createManyNotifications(criticalItems);
      }
    }

    // ── Google Sheets sync (fire-and-forget) ─────────

    // Change tracking sync (Minor / Major)
    if (changeType && changeType !== 'NONE') {
      (async () => {
        try {
          const row = await findRowByCrmId(id);
          if (!row) return;

          if (changeType === 'MINOR') {
            await prisma.project.update({ where: { id }, data: { minorChanges: { increment: 1 } } });
            await incrementCell(row, SHEET_COLUMNS.MINOR_CHANGES);
          } else if (changeType === 'MAJOR') {
            const latestComment = await prisma.comment.findFirst({
              where: { projectId: id },
              orderBy: { createdAt: 'desc' },
              select: { content: true },
            });
            const currentProject = await prisma.project.findUnique({
              where: { id },
              select: { majorChanges: true, majorChangeReason: true },
            });
            const newCount = (currentProject?.majorChanges || 0) + 1;
            const reasonEntry = `${newCount}) ${latestComment?.content || 'No comment provided'}`;
            const existingReason = currentProject?.majorChangeReason || '';
            const updatedReason = existingReason ? `${existingReason}\n${reasonEntry}` : reasonEntry;

            await prisma.project.update({
              where: { id },
              data: { majorChanges: { increment: 1 }, majorChangeReason: updatedReason },
            });

            const newMajorCount = await incrementCell(row, SHEET_COLUMNS.MAJOR_CHANGES);
            const existingSheetReason = await getCellValue(row, SHEET_COLUMNS.MAJOR_CHANGE_REASON);
            const sheetEntry = `${newMajorCount}) ${latestComment?.content || 'No comment provided'}`;
            const updatedSheetReason = existingSheetReason
              ? `${existingSheetReason}\n${sheetEntry}`
              : sheetEntry;
            await updateCell(row, SHEET_COLUMNS.MAJOR_CHANGE_REASON, updatedSheetReason);
          }
        } catch (err) {
          console.error('[GoogleSheets] change tracking sync failed:', err);
        }
      })();
    }

    // Status change sync
    if (updateData.status && updateData.status !== existing.status) {
      (async () => {
        try {
          const row = await findRowByCrmId(id);
          if (!row) return;
          const colInfo = await prisma.boardColumn.findFirst({
            where: { boardId: existing.boardId, key: updateData.status },
            select: { name: true },
          });
          await updateCell(row, SHEET_COLUMNS.STATUS, colInfo?.name || updateData.status);
          if (updateData.status === 'completed') {
            await updateCell(row, SHEET_COLUMNS.ACTUAL_COMPLETION, format(new Date(), 'MM/dd/yyyy'));
            await updateCell(row, SHEET_COLUMNS.SIGN_OFF, 'Signed Off');
          }
        } catch (err) {
          console.error('[GoogleSheets] status sync failed:', err);
        }
      })();
    }

    res.status(200).json({ success: true, message: 'Project updated', data: { project } });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Delete project ────────────────────────────────

export const deleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }

    const deletedProjectId = existing.id;
    await prisma.project.delete({ where: { id } });

    // ── Google Sheets sync (fire-and-forget) ─────────
    (async () => {
      try {
        const row = await findRowByCrmId(deletedProjectId);
        if (!row) return;
        await updateCell(row, SHEET_COLUMNS.STATUS, 'Deleted');
      } catch (err) {
        console.error('[GoogleSheets] delete sync failed:', err);
      }
    })();

    if (req.user) {
      await prisma.activityLog.create({
        data: { action: `Deleted project: ${existing.name}`, userId: req.user.id },
      });

      const actorName = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } }))?.name || 'Someone';
      const assignedUserIds = await prisma.projectAssignment.findMany({
        where: { projectId: id },
        select: { userId: true },
      });
      const recipients = assignedUserIds.map(a => a.userId).filter(uid => uid !== req.user!.id);
      const deleteItems = recipients.map((uid) => ({
        type: 'deleted',
        message: `${actorName} deleted project: ${existing.name}`,
        userId: uid,
        actorId: req.user!.id,
      }));
      await createManyNotifications(deleteItems);
    }

    res.status(200).json({ success: true, message: 'Project deleted' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Comments ──────────────────────────────────────

export const addComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ success: false, message: 'Content is required' });
      return;
    }

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) { res.status(404).json({ success: false, message: 'Project not found' }); return; }

    const comment = await prisma.comment.create({
      data: { content, projectId: id, userId: req.user!.id },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });

    await prisma.activityLog.create({
      data: { action: 'Added comment', projectId: id, userId: req.user!.id },
    });

    // Notify PM, developer, and @mentioned users
    const actorName = (await prisma.user.findUnique({ where: { id: req.user!.id }, select: { name: true } }))?.name || 'Someone';
    const snippet = content.length > 50 ? content.substring(0, 50) + '...' : content;
    const recipientIds = new Set<string>();

    // Add all assigned users (except commenter)
    const assignedForComment = await prisma.projectAssignment.findMany({
      where: { projectId: id },
      select: { userId: true },
    });
    assignedForComment.forEach(a => {
      if (a.userId !== req.user!.id) recipientIds.add(a.userId);
    });

    // Parse @mentions
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const mentions = content.match(mentionRegex);
    if (mentions) {
      const allUsers = await prisma.user.findMany({ select: { id: true, name: true } });
      for (const match of mentions) {
        const username = match.substring(1).toLowerCase();
        const mentioned = allUsers.find(u => u.name.toLowerCase().replace(/\s+/g, '') === username);
        if (mentioned && mentioned.id !== req.user!.id) recipientIds.add(mentioned.id);
      }
    }

    const notifItems = [...recipientIds].map((uid) => ({
      type: 'comment',
      message: `${actorName} commented on ${project.name}: "${snippet}"`,
      userId: uid,
      projectId: id,
      actorId: req.user!.id,
    }));
    await createManyNotifications(notifItems);

    res.status(201).json({ success: true, data: { comment } });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;

    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: { content },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });

    res.status(200).json({ success: true, data: { comment } });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { commentId } = req.params;
    await prisma.comment.delete({ where: { id: commentId } });
    res.status(200).json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Checklist ─────────────────────────────────────

export const updateChecklist = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { items } = req.body; // Array of { id?, title, completed, position }

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) { res.status(404).json({ success: false, message: 'Project not found' }); return; }

    // Delete existing and recreate (simple upsert pattern)
    await prisma.checklistItem.deleteMany({ where: { projectId: id } });

    if (items && items.length > 0) {
      await prisma.checklistItem.createMany({
        data: items.map((item: any, index: number) => ({
          title: item.title,
          completed: item.completed || false,
          position: item.position ?? index,
          projectId: id,
        })),
      });
    }

    const checklist = await prisma.checklistItem.findMany({
      where: { projectId: id },
      orderBy: { position: 'asc' },
    });

    // Notify assigned users when all checklist items are completed
    if (items && items.length > 0 && items.every((item: any) => item.completed)) {
      const proj = await prisma.project.findUnique({ where: { id }, select: { name: true } });
      if (proj && req.user) {
        const devName = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } }))?.name || 'Someone';
        const assignedForChecklist = await prisma.projectAssignment.findMany({
          where: { projectId: id },
          select: { userId: true },
        });
        const checklistRecipients = assignedForChecklist.map(a => a.userId).filter(uid => uid !== req.user!.id);
        const checklistItems = checklistRecipients.map(uid => ({
          type: 'checklist',
          message: `✅ ${devName} completed all checklist items on ${proj.name}`,
          userId: uid,
          projectId: id,
          actorId: req.user!.id,
        }));
        await createManyNotifications(checklistItems);
      }
    }

    res.status(200).json({ success: true, data: { checklist } });
  } catch (error) {
    console.error('Update checklist error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Labels ────────────────────────────────────────

export const addLabel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // project ID
    const { name, color } = req.body;

    if (!name || !color) {
      res.status(400).json({ success: false, message: 'name and color are required' });
      return;
    }

    // Find or create the label
    let label = await prisma.label.findUnique({ where: { name } });
    if (!label) {
      label = await prisma.label.create({ data: { name, color } });
    }

    // Attach to project (ignore if already attached)
    await prisma.projectLabel.upsert({
      where: { projectId_labelId: { projectId: id, labelId: label.id } },
      create: { projectId: id, labelId: label.id },
      update: {},
    });

    res.status(200).json({ success: true, data: { label } });
  } catch (error) {
    console.error('Add label error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const removeLabel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, labelId } = req.params;
    await prisma.projectLabel.delete({
      where: { projectId_labelId: { projectId: id, labelId } },
    });
    res.status(200).json({ success: true, message: 'Label removed from project' });
  } catch (error) {
    console.error('Remove label error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Attachments ───────────────────────────────────

export const addAttachment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { filename, url, key, type, size } = req.body;

    if (!filename || !url) {
      res.status(400).json({ success: false, message: 'filename and url are required' });
      return;
    }

    const attachment = await prisma.attachment.create({
      data: { filename, url, key, type: type || 'image', size, projectId: id },
    });

    await prisma.activityLog.create({
      data: { action: `Added attachment: ${filename}`, projectId: id, userId: req.user!.id },
    });

    // Notify assigned users about new file
    const uploaderName = (await prisma.user.findUnique({ where: { id: req.user!.id }, select: { name: true } }))?.name || 'Someone';
    const project = await prisma.project.findUnique({ where: { id }, select: { name: true } });
    if (project) {
      const assignedForAttachment = await prisma.projectAssignment.findMany({
        where: { projectId: id },
        select: { userId: true },
      });
      const attRecipients = assignedForAttachment.map(a => a.userId).filter(uid => uid !== req.user!.id);
      const attItems = attRecipients.map((uid) => ({
        type: 'attachment',
        message: `${uploaderName} uploaded a file to ${project.name}: ${filename}`,
        userId: uid,
        projectId: id,
        actorId: req.user!.id,
      }));
      await createManyNotifications(attItems);
    }

    res.status(201).json({ success: true, data: { attachment } });
  } catch (error) {
    console.error('Add attachment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const removeAttachment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { attachmentId } = req.params;
    await prisma.attachment.delete({ where: { id: attachmentId } });
    res.status(200).json({ success: true, message: 'Attachment deleted' });
  } catch (error) {
    console.error('Remove attachment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Reorder projects ──────────────────────────────

export const reorderProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderedIds } = req.body; // Array of { id, position, status }

    if (!orderedIds || !Array.isArray(orderedIds)) {
      res.status(400).json({ success: false, message: 'orderedIds array is required' });
      return;
    }

    // Batch update positions
    await prisma.$transaction(
      orderedIds.map((item: { id: string; position: number; status?: string }) => {
        const data: any = { position: item.position };
        if (item.status) {
          // Status is now a string matching board column keys — pass through directly
          data.status = item.status;
        }
        return prisma.project.update({
          where: { id: item.id },
          data,
        });
      })
    );

    // ── Google Sheets sync (fire-and-forget) ─────────
    for (const item of orderedIds) {
      if (item.status) {
        const itemId = item.id;
        const itemStatus = item.status;
        (async () => {
          try {
            const row = await findRowByCrmId(itemId);
            if (!row) return;
            const colInfo = await prisma.boardColumn.findFirst({
              where: { key: itemStatus },
              select: { name: true },
            });
            await updateCell(row, SHEET_COLUMNS.STATUS, colInfo?.name || itemStatus);
            if (itemStatus === 'completed') {
              await updateCell(row, SHEET_COLUMNS.ACTUAL_COMPLETION, format(new Date(), 'MM/dd/yyyy'));
              await updateCell(row, SHEET_COLUMNS.SIGN_OFF, 'Signed Off');
            }
          } catch (err) {
            console.error('[GoogleSheets] reorder status sync failed:', err);
          }
        })();
      }
    }

    res.status(200).json({ success: true, message: 'Projects reordered' });
  } catch (error) {
    console.error('Reorder projects error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Activity Log ──────────────────────────────────

export const getActivityLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const activities = await prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        project: { select: { id: true, name: true, boardId: true } },
      },
    });

    res.status(200).json({ success: true, data: { activities } });
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
