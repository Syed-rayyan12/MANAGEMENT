import { Request, Response } from 'express';
import { PrismaClient, WorkspaceType } from '@prisma/client';

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
};

/**
 * Build a role-based where clause for project queries.
 */
function buildWhereClause(user: Request['user']) {
  if (!user) return {};
  if (user.role === 'PM') return { pmId: user.id };
  if (user.role === 'TL' || user.role === 'PRODUCTION') return { developerId: user.id };
  return {}; // EXECUTIVE sees all
}

// ─── Workspace-specific getters (backward-compatible routes) ────

const workspaceGetter = (workspace: WorkspaceType) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const where = { ...buildWhereClause(req.user), workspace };
      const projects = await prisma.project.findMany({
        where,
        include: projectIncludes,
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({
        success: true,
        message: `${workspace} projects retrieved successfully`,
        data: { projects },
      });
    } catch (error) {
      console.error(`Get ${workspace} projects error:`, error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
};

export const getLogoDesignProjects = workspaceGetter('LOGO');
export const getWebDesignProjects = workspaceGetter('WEB_DESIGN');
export const getWebDevelopmentProjects = workspaceGetter('WEB_DEVELOPMENT');
export const getContentWriterProjects = workspaceGetter('CONTENT');

// ─── Get all projects ───────────────────────────────

export const getAllProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const where = buildWhereClause(req.user);
    const projects = await prisma.project.findMany({
      where,
      include: projectIncludes,
      orderBy: { createdAt: 'desc' },
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
    const { name, workspace, description, priority, dueDate, pmId, developerId, image } = req.body;

    const projectPmId = pmId || req.user?.id;

    if (!name || !workspace || !projectPmId) {
      res.status(400).json({ success: false, message: 'Name, workspace, and PM ID are required' });
      return;
    }

    const validWorkspaces: WorkspaceType[] = ['LOGO', 'WEB_DESIGN', 'WEB_DEVELOPMENT', 'CONTENT'];
    if (!validWorkspaces.includes(workspace)) {
      res.status(400).json({ success: false, message: 'Invalid workspace type' });
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

    const project = await prisma.project.create({
      data: {
        name,
        workspace,
        description,
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

    res.status(201).json({
      success: true,
      message: `Project created in ${workspace} workspace`,
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
    const { workspace, ...updateData } = req.body;

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }

    // Validate status
    if (updateData.status) {
      const valid = ['TODO', 'IN_PROGRESS', 'COMPLETED', 'REVISIONS'];
      if (!valid.includes(updateData.status)) {
        res.status(400).json({ success: false, message: 'Invalid status' });
        return;
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
