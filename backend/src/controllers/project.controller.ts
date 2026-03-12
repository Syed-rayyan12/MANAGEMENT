import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createNotification, createManyNotifications } from './notification.controller';

const prisma = new PrismaClient();

// Shared include for loading project relations
const projectIncludes = {
  pm: { select: { id: true, name: true, email: true, avatar: true, role: true } },
  developer: { select: { id: true, name: true, email: true, avatar: true, role: true } },
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
  workspace: { select: { id: true, name: true, teamId: true } },
};

/**
 * Check if user can access a workspace.
 * - EXECUTIVE: can see all workspaces
 * - PRODUCTION: can see tasks assigned to them (handled at query level)
 * - TL/PM: can only see workspaces for teams they belong to
 */
async function canUserAccessWorkspace(userId: string, role: string, workspaceId: string): Promise<boolean> {
  if (role === 'EXECUTIVE') return true;
  // For PRODUCTION, access is per-project (assigned tasks), not per-workspace
  if (role === 'PRODUCTION') return true;

  // Check if user is a member of the team that owns this workspace
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { teamId: true },
  });
  if (!workspace) return false;

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: workspace.teamId, userId } },
  });
  return !!membership;
}

/**
 * Build WHERE clause scoped to user's accessible workspaces.
 */
async function buildWhereClause(user: Request['user']): Promise<Record<string, unknown>> {
  if (!user) return { id: 'none' }; // return impossible condition

  // EXECUTIVE sees all
  if (user.role === 'EXECUTIVE') return {};

  // PRODUCTION sees only tasks assigned to them
  if (user.role === 'PRODUCTION') return { developerId: user.id };

  // TL/PM: see projects in workspaces belonging to their teams
  if (user.teamIds && user.teamIds.length > 0) {
    const workspaces = await prisma.workspace.findMany({
      where: { teamId: { in: user.teamIds } },
      select: { id: true },
    });
    return { workspaceId: { in: workspaces.map(w => w.id) } };
  }

  return { id: 'none' }; // no teams = no access
}

// ─── Get projects by workspace ──────────────────────

export const getWorkspaceProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const { workspaceId } = req.params;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Verify workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { team: { select: { id: true, name: true, slug: true } } },
    });
    if (!workspace) {
      res.status(404).json({ success: false, message: 'Workspace not found' });
      return;
    }

    // Check access
    const hasAccess = await canUserAccessWorkspace(req.user.id, req.user.role, workspaceId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Access denied to this workspace' });
      return;
    }

    const where: any = { workspaceId };

    // PRODUCTION only sees tasks assigned to them
    if (req.user.role === 'PRODUCTION') {
      where.developerId = req.user.id;
    }

    const projects = await prisma.project.findMany({
      where,
      include: projectIncludes,
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    });

    res.status(200).json({
      success: true,
      message: `Projects retrieved for workspace: ${workspace.name}`,
      data: { projects },
    });
  } catch (error) {
    console.error('Get workspace projects error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Get all projects (scoped to user) ──────────────

export const getAllProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const where = await buildWhereClause(req.user);
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
    const { name, workspaceId, description, priority, dueDate, pmId, developerId, image, status } = req.body;

    const projectPmId = pmId || req.user?.id;

    if (!name || !workspaceId || !projectPmId) {
      res.status(400).json({ success: false, message: 'Name, workspaceId, and PM ID are required' });
      return;
    }

    // Verify workspace exists
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) {
      res.status(404).json({ success: false, message: 'Workspace not found' });
      return;
    }

    // Verify PM
    const pm = await prisma.user.findUnique({ where: { id: projectPmId } });
    if (!pm) { res.status(404).json({ success: false, message: 'PM not found' }); return; }
    if (pm.role !== 'PM') { res.status(403).json({ success: false, message: 'Only PM role users can be assigned as PM' }); return; }

    // Verify developer if provided
    if (developerId) {
      const dev = await prisma.user.findUnique({ where: { id: developerId } });
      if (!dev) { res.status(404).json({ success: false, message: 'Developer not found' }); return; }
    }

    // If status is provided, validate it matches a workspace column key
    if (status) {
      const column = await prisma.workspaceColumn.findUnique({
        where: { workspaceId_key: { workspaceId, key: status } },
      });
      if (!column) {
        res.status(400).json({ success: false, message: `Invalid status "${status}" for this workspace` });
        return;
      }
    }

    const project = await prisma.project.create({
      data: {
        name,
        workspaceId,
        description,
        status: status || 'todo',
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        pmId: projectPmId,
        developerId: developerId || null,
        image: image || null,
      },
      include: projectIncludes,
    });

    // Log activity
    await prisma.activityLog.create({
      data: { action: `Created project: ${name}`, projectId: project.id, userId: projectPmId },
    });

    // Notify assigned developer
    if (developerId && developerId !== projectPmId) {
      const pmUser = await prisma.user.findUnique({ where: { id: projectPmId }, select: { name: true } });
      await createNotification({
        type: 'assigned',
        message: `${pmUser?.name || 'A PM'} assigned you to project: ${name}`,
        userId: developerId,
        projectId: project.id,
        actorId: projectPmId,
      });
    }

    res.status(201).json({
      success: true,
      message: `Project created in workspace`,
      data: { project },
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Get project by ID ─────────────────────────────

export const getProjectById = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
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

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }

    // Validate status if provided
    if (updateData.status) {
      // Validate against workspace columns
      const project_ws = await prisma.project.findUnique({
        where: { id },
        select: { workspaceId: true },
      });
      if (project_ws) {
        const column = await prisma.workspaceColumn.findUnique({
          where: { workspaceId_key: { workspaceId: project_ws.workspaceId, key: updateData.status } },
        });
        if (!column) {
          res.status(400).json({ success: false, message: `Invalid status "${updateData.status}" for this workspace` });
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

    // Verify PM if changing
    if (updateData.pmId) {
      const pm = await prisma.user.findUnique({ where: { id: updateData.pmId } });
      if (!pm) { res.status(404).json({ success: false, message: 'PM not found' }); return; }
      if (pm.role !== 'PM') { res.status(403).json({ success: false, message: 'User is not a PM' }); return; }
    }

    // Verify developer if changing
    if (updateData.developerId) {
      const dev = await prisma.user.findUnique({ where: { id: updateData.developerId } });
      if (!dev) { res.status(404).json({ success: false, message: 'Developer not found' }); return; }
    }

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

      // Notify new developer if assignment changed
      if (updateData.developerId && updateData.developerId !== existing.developerId && updateData.developerId !== req.user.id) {
        await createNotification({
          type: 'assigned',
          message: `${actorName} assigned you to project: ${existing.name}`,
          userId: updateData.developerId,
          projectId: id,
          actorId: req.user.id,
        });
      }

      // Notify on status change
      if (updateData.status && updateData.status !== existing.status) {
        const recipients = new Set<string>();
        if (existing.pmId && existing.pmId !== req.user.id) recipients.add(existing.pmId);
        if (existing.developerId && existing.developerId !== req.user.id) recipients.add(existing.developerId);

        const isCompleted = updateData.status === 'completed';
        const statusItems = [...recipients].map((uid) => ({
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

      // Notify developer when priority escalated to CRITICAL
      if (updateData.priority && updateData.priority !== existing.priority && updateData.priority === 'CRITICAL') {
        if (existing.developerId && existing.developerId !== req.user.id) {
          await createNotification({
            type: 'priority',
            message: `⚠️ ${actorName} escalated ${existing.name} to CRITICAL priority`,
            userId: existing.developerId,
            projectId: id,
            actorId: req.user.id,
          });
        }
      }
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

    await prisma.project.delete({ where: { id } });

    if (req.user) {
      await prisma.activityLog.create({
        data: { action: `Deleted project: ${existing.name}`, userId: req.user.id },
      });

      const actorName = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } }))?.name || 'Someone';
      const recipients = new Set<string>();
      if (existing.pmId && existing.pmId !== req.user.id) recipients.add(existing.pmId);
      if (existing.developerId && existing.developerId !== req.user.id) recipients.add(existing.developerId);
      const deleteItems = [...recipients].map((uid) => ({
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

    // Add PM and developer (except commenter)
    if (project.pmId && project.pmId !== req.user!.id) recipientIds.add(project.pmId);
    if (project.developerId && project.developerId !== req.user!.id) recipientIds.add(project.developerId);

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

    // Notify PM when all checklist items are completed
    if (items && items.length > 0 && items.every((item: any) => item.completed)) {
      const proj = await prisma.project.findUnique({ where: { id }, select: { pmId: true, developerId: true, name: true } });
      if (proj && req.user && proj.pmId && proj.pmId !== req.user.id) {
        const devName = (await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } }))?.name || 'Someone';
        await createNotification({
          type: 'checklist',
          message: `✅ ${devName} completed all checklist items on ${proj.name}`,
          userId: proj.pmId,
          projectId: id,
          actorId: req.user.id,
        });
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

    // Notify PM + developer about new file
    const uploaderName = (await prisma.user.findUnique({ where: { id: req.user!.id }, select: { name: true } }))?.name || 'Someone';
    const project = await prisma.project.findUnique({ where: { id }, select: { pmId: true, developerId: true, name: true } });
    if (project) {
      const attRecipients = new Set<string>();
      if (project.pmId && project.pmId !== req.user!.id) attRecipients.add(project.pmId);
      if (project.developerId && project.developerId !== req.user!.id) attRecipients.add(project.developerId);
      const attItems = [...attRecipients].map((uid) => ({
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
          // Status is now a string matching workspace column keys — pass through directly
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
        project: { select: { id: true, name: true, workspaceId: true } },
      },
    });

    res.status(200).json({ success: true, data: { activities } });
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
