import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// ─── Add Member to Project ──────────────────────────

export const addAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params.id || req.params.projectId;
    const { userId, role } = req.body;

    // Verify project exists
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Check for duplicate assignment
    const existing = await prisma.projectAssignment.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (existing) {
      res.status(409).json({ success: false, message: `${user.name} is already assigned to this project` });
      return;
    }

    const assignment = await prisma.projectAssignment.create({
      data: {
        projectId,
        userId,
        role: role || 'PRIMARY',
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true, role: true, specialization: true } },
      },
    });

    res.status(201).json({ success: true, message: 'Member added', data: { assignment } });
  } catch (error) {
    console.error('Add assignment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Update Assignment (role or status) ─────────────

export const updateAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { assignmentId } = req.params;
    const { role, status } = req.body;

    const existing = await prisma.projectAssignment.findUnique({ where: { id: assignmentId } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Assignment not found' });
      return;
    }

    // Permission check for status toggle: own assignment OR PM/TL
    if (status && existing.userId !== req.user?.id) {
      const requester = await prisma.user.findUnique({ where: { id: req.user?.id }, select: { role: true } });
      if (requester?.role !== 'PM' && requester?.role !== 'TL' && requester?.role !== 'EXECUTIVE' && requester?.role !== 'PRODUCTION') {
        res.status(403).json({ success: false, message: 'You can only toggle your own assignment status' });
        return;
      }
    }

    const updateData: Record<string, unknown> = {};
    if (role) updateData.role = role;
    if (status) {
      updateData.status = status;
      updateData.completedAt = status === 'DONE' ? new Date() : null;
    }

    const assignment = await prisma.projectAssignment.update({
      where: { id: assignmentId },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true, role: true, specialization: true } },
      },
    });

    res.status(200).json({ success: true, message: 'Assignment updated', data: { assignment } });
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Remove Assignment ──────────────────────────────

export const removeAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { assignmentId } = req.params;

    const existing = await prisma.projectAssignment.findUnique({ where: { id: assignmentId } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Assignment not found' });
      return;
    }

    await prisma.projectAssignment.delete({ where: { id: assignmentId } });

    res.status(200).json({ success: true, message: 'Member removed from project' });
  } catch (error) {
    console.error('Remove assignment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
