import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { startImportRun, isImportActive } from '../services/trelloImport.service';

const AUTHORIZED_USERNAME = 'prod.tahiranwar';

async function checkTrelloAuth(req: Request, res: Response): Promise<boolean> {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return false;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.username !== AUTHORIZED_USERNAME) {
    res.status(403).json({ success: false, message: 'Forbidden: only prod.tahiranwar can access Trello import' });
    return false;
  }

  return true;
}

/**
 * Get Trello boards for the authenticated user's Trello account.
 * GET /api/trello/boards?apiKey=...&token=...
 */
export const getTrelloBoards = async (req: Request, res: Response): Promise<void> => {
  try {
    const authorized = await checkTrelloAuth(req, res);
    if (!authorized) return;

    const { apiKey, token } = req.query as { apiKey?: string; token?: string };

    if (!apiKey || !token) {
      res.status(400).json({ success: false, message: 'apiKey and token are required' });
      return;
    }

    const response = await fetch(
      `https://api.trello.com/1/members/me/boards?fields=name,id,url&key=${apiKey}&token=${token}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      res.status(400).json({
        success: false,
        message: `Trello API error: ${errorText}`,
      });
      return;
    }

    const boards = await response.json();

    res.status(200).json({
      success: true,
      message: 'Trello boards fetched successfully',
      data: { boards },
    });
  } catch (error) {
    console.error('Error fetching Trello boards:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Start a background import run.
 * POST /api/trello/import
 * Body: { apiKey, token, trelloBoardId }
 */
export const startImport = async (req: Request, res: Response): Promise<void> => {
  try {
    const authorized = await checkTrelloAuth(req, res);
    if (!authorized) return;

    const { apiKey, token, trelloBoardId } = req.body as {
      apiKey?: string; token?: string; trelloBoardId?: string;
    };

    if (!apiKey || !token || !trelloBoardId) {
      res.status(400).json({ success: false, message: 'apiKey, token, and trelloBoardId are required' });
      return;
    }

    if (isImportActive()) {
      res.status(409).json({ success: false, message: 'An import is already running' });
      return;
    }

    const runId = await startImportRun({
      apiKey,
      token,
      trelloBoardId,
      userId: (req as any).user.id,
    });

    res.status(202).json({
      success: true,
      message: 'Import started',
      data: { runId },
    });
  } catch (error) {
    console.error('Error starting Trello import:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get the most recent import run (or null if none exist).
 * GET /api/trello/import/latest
 */
export const getLatestImportRun = async (req: Request, res: Response): Promise<void> => {
  try {
    const authorized = await checkTrelloAuth(req, res);
    if (!authorized) return;

    const run = await prisma.trelloImportRun.findFirst({
      orderBy: { startedAt: 'desc' },
    });

    res.status(200).json({ success: true, data: { run } });
  } catch (error) {
    console.error('Error fetching latest Trello import run:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get a specific import run by id.
 * GET /api/trello/import/:runId
 */
export const getImportRun = async (req: Request, res: Response): Promise<void> => {
  try {
    const authorized = await checkTrelloAuth(req, res);
    if (!authorized) return;

    const run = await prisma.trelloImportRun.findUnique({
      where: { id: req.params.runId },
    });

    if (!run) {
      res.status(404).json({ success: false, message: 'Import run not found' });
      return;
    }

    res.status(200).json({ success: true, data: { run } });
  } catch (error) {
    console.error('Error fetching Trello import run:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
