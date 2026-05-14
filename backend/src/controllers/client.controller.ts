import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// ─── Get Clients ─────────────────────────────────────

export const getClients = async (_req: Request, res: Response): Promise<void> => {
  try {
    const clients = await prisma.client.findMany({
      include: {
        projects: {
          select: {
            id: true,
            name: true,
            status: true,
            board: { select: { name: true, slug: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({ success: true, message: 'Data retrieved successfully', data: { clients } });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Create Client ────────────────────────────────────

export const createClient = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, contactEmail } = req.body;

    const org = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!org) {
      res.status(500).json({ success: false, message: 'No organization found' });
      return;
    }

    const client = await prisma.client.create({
      data: {
        name,
        contactEmail: contactEmail || null,
        organizationId: org.id,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Client created',
      data: { client },
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
