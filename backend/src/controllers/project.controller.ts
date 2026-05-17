import { Request, Response } from 'express';
import { createManyNotifications } from './notification.controller';
import prisma from '../lib/prisma';
import { emitBoardEvent } from '../socket/emitHelper';

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

// Lightweight include for list endpoints (Kanban cards, board views).
// Drops comment content, attachment data, and activity logs entirely.
// Comments/attachments return only { id } so frontend can use .length for counts.
const projectCardIncludes = {
  assignments: {
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true, role: true, specialization: true } },
    },
    orderBy: { assignedAt: 'asc' as const },
  },
  comments: { select: { id: true } },
  checklist: { orderBy: { position: 'asc' as const } },
  labels: { include: { label: true } },
  attachments: { select: { id: true } },
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
      include: projectCardIncludes,
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
      include: projectCardIncludes,
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

    // Determine teamId — PRODUCTION users can specify a team, others use their membership
    let teamId: string;

    if (req.body.teamId) {
      // Explicit team selection (used by PRODUCTION users who aren't team members)
      const team = await prisma.team.findUnique({ where: { id: req.body.teamId } });
      if (!team) {
        res.status(400).json({ success: false, message: 'Specified team not found' });
        return;
      }
      teamId = team.id;
    } else {
      const creatorMemberships = await prisma.teamMember.findMany({
        where: { userId: creatorId },
        select: { teamId: true },
      });
      if (creatorMemberships.length === 0) {
        // PRODUCTION users may not be team members — assign to first available team
        if (req.user?.role === 'PRODUCTION') {
          const firstTeam = await prisma.team.findFirst({ select: { id: true } });
          if (!firstTeam) {
            res.status(400).json({ success: false, message: 'No teams available' });
            return;
          }
          teamId = firstTeam.id;
        } else {
          res.status(400).json({ success: false, message: 'You must belong to a team or specify a teamId to create projects' });
          return;
        }
      } else {
        teamId = creatorMemberships[0].teamId;
      }
    }

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

    res.status(201).json({
      success: true,
      message: 'Project created',
      data: { project: fullProject },
    });

    // ── Real-time broadcast ──────────────────────────
    if (fullProject?.board?.slug) {
      emitBoardEvent(
        fullProject.board.slug,
        'project:created',
        fullProject,
        req.headers['x-socket-id'] as string | undefined,
      );
    }
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

    // ── Conflict detection (optimistic concurrency) ──
    if (updateData.lastUpdatedAt) {
      const clientUpdatedAt = new Date(updateData.lastUpdatedAt).getTime();
      const serverUpdatedAt = existing.updatedAt.getTime();
      if (clientUpdatedAt !== serverUpdatedAt) {
        // Someone else modified this project since the client last fetched it
        const currentProject = await prisma.project.findUnique({
          where: { id },
          include: projectCardIncludes,
        });
        const lastEditor = await prisma.activityLog.findFirst({
          where: { projectId: id },
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true } } },
        });
        res.status(409).json({
          success: false,
          conflict: true,
          message: 'Project was modified by another user',
          updatedBy: lastEditor?.user?.name || 'someone',
          current: currentProject,
        });
        return;
      }
      // Remove lastUpdatedAt from updateData — it's not a DB field
      delete updateData.lastUpdatedAt;
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

      // Fetch assigned users once, reuse for both status and priority notifications
      const needsNotification =
        (updateData.status && updateData.status !== existing.status) ||
        (updateData.priority && updateData.priority !== existing.priority && updateData.priority === 'CRITICAL');

      if (needsNotification) {
        const assignedUserIds = await prisma.projectAssignment.findMany({
          where: { projectId: id },
          select: { userId: true },
        });
        const recipients = assignedUserIds
          .map(a => a.userId)
          .filter(uid => uid !== req.user!.id);

        // Status change notification
        if (updateData.status && updateData.status !== existing.status) {
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

        // Priority escalation notification
        if (updateData.priority && updateData.priority !== existing.priority && updateData.priority === 'CRITICAL') {
          const criticalItems = recipients.map(uid => ({
            type: 'priority',
            message: `⚠️ ${actorName} escalated ${existing.name} to CRITICAL priority`,
            userId: uid,
            projectId: id,
            actorId: req.user!.id,
          }));
          await createManyNotifications(criticalItems);
        }
      }
    }

    // ── Regression detection + auto-complete assignments ─────────────────────────
    if (updateData.status && updateData.status !== existing.status && req.user) {
      const [oldCol, newCol] = await Promise.all([
        prisma.boardColumn.findFirst({ where: { boardId: existing.boardId, key: existing.status } }),
        prisma.boardColumn.findFirst({ where: { boardId: existing.boardId, key: updateData.status } }),
      ]);

      if (oldCol && newCol && newCol.position < oldCol.position) {
        // Backward move detected — find PRIMARY production assignees
        const productionAssignees = await prisma.projectAssignment.findMany({
          where: { projectId: id, role: 'PRIMARY', user: { role: 'PRODUCTION' } },
          select: { userId: true },
        });

        // Only create regression if the mover is NOT one of the assigned production users
        const moverId = req.user.id;
        const targetUsers = productionAssignees
          .map(a => a.userId)
          .filter(uid => uid !== moverId);

        if (targetUsers.length > 0) {
          await prisma.regression.createMany({
            data: targetUsers.map(userId => ({
              projectId: id,
              userId,
              causedById: moverId,
              fromColumn: existing.status,
              toColumn: updateData.status,
            })),
          });
        }
      }

      // Auto-complete assignments when project moves to a DONE-phase column
      if (newCol && newCol.phase === 'DONE') {
        await prisma.projectAssignment.updateMany({
          where: { projectId: id, status: 'ACTIVE' },
          data: { status: 'DONE', completedAt: new Date() },
        });
      }

      // Re-activate assignments if project moves OUT of DONE phase back to active
      if (oldCol && oldCol.phase === 'DONE' && newCol && newCol.phase !== 'DONE') {
        await prisma.projectAssignment.updateMany({
          where: { projectId: id, status: 'DONE' },
          data: { status: 'ACTIVE', completedAt: null },
        });
      }
    }

    res.status(200).json({ success: true, message: 'Project updated', data: { project } });

    // ── Real-time broadcast ──────────────────────────
    if (project.board?.slug) {
      emitBoardEvent(
        project.board.slug,
        'project:updated',
        project,
        req.headers['x-socket-id'] as string | undefined,
      );
    }
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

    await prisma.project.delete({ where: { id } });

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

    // ── Real-time broadcast ──────────────────────────
    const boardForBroadcast = await prisma.board.findUnique({
      where: { id: existing.boardId },
      select: { slug: true },
    });
    if (boardForBroadcast?.slug) {
      emitBoardEvent(
        boardForBroadcast.slug,
        'project:deleted',
        { projectId: existing.id },
        req.headers['x-socket-id'] as string | undefined,
      );
    }
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

    // ── Real-time broadcast ──────────────────────────
    const boardForComment = await prisma.board.findUnique({
      where: { id: project.boardId },
      select: { slug: true },
    });
    if (boardForComment?.slug) {
      const updatedProject = await prisma.project.findUnique({
        where: { id },
        include: projectCardIncludes,
      });
      if (updatedProject) {
        emitBoardEvent(
          boardForComment.slug,
          'project:updated',
          updatedProject,
          req.headers['x-socket-id'] as string | undefined,
        );
      }
    }
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
          createdBy: item.createdBy || req.user?.id || null,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
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

    // ── Real-time broadcast ──────────────────────────
    if (project.boardId) {
      const boardForChecklist = await prisma.board.findUnique({
        where: { id: project.boardId },
        select: { slug: true },
      });
      if (boardForChecklist?.slug) {
        const updatedProject = await prisma.project.findUnique({
          where: { id },
          include: projectCardIncludes,
        });
        if (updatedProject) {
          emitBoardEvent(
            boardForChecklist.slug,
            'project:updated',
            updatedProject,
            req.headers['x-socket-id'] as string | undefined,
          );
        }
      }
    }
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
    const project = await prisma.project.findUnique({ where: { id }, select: { name: true, boardId: true } });
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

    // ── Real-time broadcast ──────────────────────────
    if (project?.boardId) {
      const boardForAttachment = await prisma.board.findUnique({
        where: { id: project.boardId },
        select: { slug: true },
      });
      if (boardForAttachment?.slug) {
        const updatedProject = await prisma.project.findUnique({
          where: { id },
          include: projectCardIncludes,
        });
        if (updatedProject) {
          emitBoardEvent(
            boardForAttachment.slug,
            'project:updated',
            updatedProject,
            req.headers['x-socket-id'] as string | undefined,
          );
        }
      }
    }
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
