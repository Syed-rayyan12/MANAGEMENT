import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { startImportRun, isImportActive } from '../services/trelloImport.service';

const AUTHORIZED_USERNAME = 'prod.tahiranwar';

function hasServerCredentials(): boolean {
  return Boolean(process.env.TRELLO_API_KEY && process.env.TRELLO_TOKEN);
}

/**
 * Resolve Trello credentials: server env vars take precedence,
 * falling back to credentials provided in the request.
 */
function resolveTrelloCredentials(provided: {
  apiKey?: string;
  token?: string;
}): { apiKey: string; token: string } | null {
  if (hasServerCredentials()) {
    return { apiKey: process.env.TRELLO_API_KEY!, token: process.env.TRELLO_TOKEN! };
  }
  if (provided.apiKey && provided.token) {
    return { apiKey: provided.apiKey, token: provided.token };
  }
  return null;
}

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
 * Report whether Trello credentials are configured on the server.
 * GET /api/trello/config
 */
export const getTrelloConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const authorized = await checkTrelloAuth(req, res);
    if (!authorized) return;

    res.status(200).json({
      success: true,
      data: { hasServerCredentials: hasServerCredentials() },
    });
  } catch (error) {
    console.error('Error fetching Trello config:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get Trello boards for the authenticated user's Trello account.
 * GET /api/trello/boards — credentials from env, or ?apiKey=...&token=...
 */
export const getTrelloBoards = async (req: Request, res: Response): Promise<void> => {
  try {
    const authorized = await checkTrelloAuth(req, res);
    if (!authorized) return;

    const creds = resolveTrelloCredentials(req.query as { apiKey?: string; token?: string });

    if (!creds) {
      res.status(400).json({ success: false, message: 'apiKey and token are required (or set TRELLO_API_KEY / TRELLO_TOKEN on the server)' });
      return;
    }

    const { apiKey, token } = creds;

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

    if (!trelloBoardId) {
      res.status(400).json({ success: false, message: 'trelloBoardId is required' });
      return;
    }

    const creds = resolveTrelloCredentials({ apiKey, token });
    if (!creds) {
      res.status(400).json({ success: false, message: 'apiKey and token are required (or set TRELLO_API_KEY / TRELLO_TOKEN on the server)' });
      return;
    }

    if (isImportActive()) {
      res.status(409).json({ success: false, message: 'An import is already running' });
      return;
    }

    const runId = await startImportRun({
      apiKey: creds.apiKey,
      token: creds.token,
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
