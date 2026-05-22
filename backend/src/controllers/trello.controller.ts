import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import prisma from '../lib/prisma';
import { uploadToR2, getPublicUrl, deleteFromR2 } from '../utils/r2';

const AUTHORIZED_USERNAME = 'prod.tahiranwar';
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25 MB
const BATCH_SIZE = 15;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, retries = 1): Promise<globalThis.Response> {
  const res = await fetch(url);
  if (res.status === 429 && retries > 0) {
    console.warn(`Trello rate limit hit, retrying in 2s...`);
    await delay(2000);
    return fetchWithRetry(url, retries - 1);
  }
  return res;
}

async function downloadTrelloFile(
  cardId: string,
  attachmentId: string,
  fileName: string,
  apiKey: string,
  token: string,
): Promise<Buffer> {
  // Trello attachment downloads require OAuth header — query params don't work
  const apiUrl = `https://api.trello.com/1/cards/${cardId}/attachments/${attachmentId}/download/${encodeURIComponent(fileName)}`;
  const res = await fetch(apiUrl, {
    headers: {
      'Authorization': `OAuth oauth_consumer_key="${apiKey}", oauth_token="${token}"`,
    },
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
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

function detectBoardSlug(listName: string, cardName: string): string {
  const lower = listName.toLowerCase();

  if (lower.includes('logo')) return 'logo-design';
  if (lower.includes('development') || lower.includes('dev')) return 'web-development';
  if (lower.includes('delivered')) {
    if (lower.includes('live')) return 'web-development';
    if (lower.includes('design')) return 'web-design';
  }
  if (lower.includes('website design') || lower.includes('design')) return 'web-design';
  if (lower.includes('seo')) return 'seo';
  if (lower.includes('content')) return 'content';
  if (lower.includes('social media')) return 'social-media';

  const cardLower = cardName.toLowerCase();
  if (cardLower.startsWith('logo:')) return 'logo-design';
  if (cardLower.startsWith('website:')) return 'web-design';

  return 'web-design';
}

const DEFAULT_COLUMNS = [
  { name: 'Todo', key: 'todo', position: 0, phase: 'NOT_STARTED' as const },
  { name: 'In Progress', key: 'in-progress', position: 1, phase: 'IN_PROGRESS' as const },
  { name: 'Completed', key: 'completed', position: 2, phase: 'DONE' as const },
  { name: 'Revisions', key: 'revisions', position: 3, phase: 'IN_PROGRESS' as const },
];

/**
 * Fetch card list from a Trello board (for the frontend to know total count).
 * POST /api/trello/prepare
 */
export const prepareTrelloImport = async (req: Request, res: Response): Promise<void> => {
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

    const response = await fetch(
      `https://api.trello.com/1/boards/${trelloBoardId}?lists=all&cards=all&card_fields=name,desc,labels,due,idList,closed&key=${apiKey}&token=${token}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      res.status(400).json({ success: false, message: `Trello API error: ${errorText}` });
      return;
    }

    const boardData: any = await response.json();
    const openCards = (boardData.cards || []).filter((card: any) => !card.closed);
    const lists = (boardData.lists || []).map((l: any) => ({ id: l.id, name: l.name }));

    res.status(200).json({
      success: true,
      data: {
        totalCards: openCards.length,
        batchSize: BATCH_SIZE,
        totalBatches: Math.ceil(openCards.length / BATCH_SIZE),
        cards: openCards.map((c: any) => ({
          id: c.id, name: c.name, desc: c.desc, labels: c.labels, due: c.due, idList: c.idList,
        })),
        lists,
      },
    });
  } catch (error) {
    console.error('Error preparing Trello import:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Import a batch of Trello cards.
 * POST /api/trello/import-batch
 *
 * Body: { apiKey, token, cards: [...], lists: [...], batchIndex }
 * Each request processes a small batch — no timeouts.
 */
export const importBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const authorized = await checkTrelloAuth(req, res);
    if (!authorized) return;

    const { apiKey, token, cards, lists } = req.body as {
      apiKey?: string;
      token?: string;
      cards?: any[];
      lists?: { id: string; name: string }[];
    };

    if (!apiKey || !token || !cards || !lists) {
      res.status(400).json({ success: false, message: 'apiKey, token, cards, and lists are required' });
      return;
    }

    const listMap = new Map<string, string>();
    for (const list of lists) {
      listMap.set(list.id, list.name);
    }

    const importingUserId = (req as any).user?.id;

    const firstTeam = await prisma.team.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!firstTeam) {
      res.status(500).json({ success: false, message: 'No teams found' });
      return;
    }

    const firstOrg = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!firstOrg) {
      res.status(500).json({ success: false, message: 'No organization found' });
      return;
    }

    const boardCache = new Map<string, string>();
    const existingBoards = await prisma.board.findMany({ where: { deletedAt: null } });
    for (const board of existingBoards) {
      boardCache.set(board.slug, board.id);
    }

    const summary = {
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      commentsImported: 0,
      commentsFailed: 0,
      attachmentsImported: 0,
      attachmentsFailed: 0,
      newBoards: [] as string[],
      details: [] as { cardName: string; status: string; reason?: string }[],
    };

    for (const card of cards) {
      const cardName: string = card.name || 'Untitled';
      const trelloCardId: string = card.id;

      try {
        const existing = await prisma.project.findUnique({
          where: { trelloCardId },
          include: { attachments: true },
        });

        const listName = listMap.get(card.idList) || '';
        const boardSlug = detectBoardSlug(listName, cardName);

        let boardId = boardCache.get(boardSlug);
        if (!boardId) {
          const boardDisplayName = boardSlug
            .split('-')
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');

          const newBoard = await prisma.board.create({
            data: {
              name: boardDisplayName,
              slug: boardSlug,
              organizationId: firstOrg.id,
              columns: {
                create: DEFAULT_COLUMNS.map((col) => ({
                  name: col.name, key: col.key, position: col.position, phase: col.phase,
                })),
              },
            },
          });

          boardId = newBoard.id;
          boardCache.set(boardSlug, boardId);
          summary.newBoards.push(boardDisplayName);
        }

        const labels: any[] = card.labels || [];
        const hasUrgent = labels.some((l: any) => l.name && l.name.toLowerCase().includes('urgent'));
        const priority = hasUrgent ? 'HIGH' : 'MEDIUM';

        let projectId: string;
        let isUpdate = false;

        if (existing) {
          isUpdate = true;
          projectId = existing.id;

          await prisma.project.update({
            where: { id: existing.id },
            data: {
              name: cardName,
              description: card.desc || null,
              priority,
              dueDate: card.due ? new Date(card.due) : null,
            },
          });

          await prisma.comment.deleteMany({ where: { projectId } });

          for (const att of existing.attachments) {
            if (att.key) {
              try { await deleteFromR2(att.key); } catch { /* ignore */ }
            }
          }
          await prisma.attachment.deleteMany({ where: { projectId } });
        } else {
          const firstColumn = await prisma.boardColumn.findFirst({
            where: { boardId, deletedAt: null },
            orderBy: { position: 'asc' },
            select: { key: true },
          });

          const newProject = await prisma.project.create({
            data: {
              name: cardName,
              description: card.desc || null,
              status: firstColumn?.key || 'todo',
              priority,
              dueDate: card.due ? new Date(card.due) : null,
              boardId,
              teamId: firstTeam.id,
              trelloCardId,
            },
          });
          projectId = newProject.id;
        }

        // --- Import comments ---
        if (importingUserId) {
          try {
            const cardCommentsRes = await fetchWithRetry(
              `https://api.trello.com/1/cards/${trelloCardId}/actions?filter=commentCard&limit=1000&key=${apiKey}&token=${token}`
            );
            if (cardCommentsRes.ok) {
              const cardActions = (await cardCommentsRes.json()) as any[];
              cardActions.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
              for (const action of cardActions) {
                const text = action.data?.text || '';
                const memberName = action.memberCreator?.fullName || action.memberCreator?.username || 'Unknown';
                await prisma.comment.create({
                  data: {
                    content: `**${memberName}** (from Trello):\n${text}`,
                    projectId,
                    userId: importingUserId,
                    createdAt: new Date(action.date),
                  },
                });
                summary.commentsImported++;
              }
            } else {
              console.error(`Comments API failed for "${cardName}": HTTP ${cardCommentsRes.status}`);
              summary.commentsFailed++;
            }
          } catch (commentError) {
            console.error(`Error fetching comments for card "${cardName}":`, commentError);
            summary.commentsFailed++;
          }
        }

        // --- Import attachments ---
        try {
          const attachRes = await fetchWithRetry(
            `https://api.trello.com/1/cards/${trelloCardId}/attachments?key=${apiKey}&token=${token}`
          );
          if (attachRes.ok) {
            const attachments = (await attachRes.json()) as any[];
            const uploadable = attachments.filter((a: any) =>
              a.isUpload !== false && a.bytes > 0 && a.bytes <= MAX_ATTACHMENT_SIZE
            );

            for (const att of uploadable) {
              try {
                const fileBuffer = await downloadTrelloFile(
                  trelloCardId, att.id, att.name || 'attachment', apiKey, token
                );

                const ext = path.extname(att.name || '') || '.bin';
                const r2Key = `trello-imports/${randomUUID()}${ext}`;
                const mimeType: string = att.mimeType || 'application/octet-stream';

                await uploadToR2(r2Key, fileBuffer, mimeType);

                await prisma.attachment.create({
                  data: {
                    filename: att.name || 'attachment',
                    url: getPublicUrl(r2Key),
                    key: r2Key,
                    type: mimeType.split('/')[0] || 'file',
                    size: att.bytes || 0,
                    projectId,
                  },
                });
                summary.attachmentsImported++;
              } catch (attError) {
                console.error(`Error importing attachment "${att.name}" for "${cardName}":`, attError);
                summary.attachmentsFailed++;
              }
            }
          } else {
            console.error(`Attachments API failed for "${cardName}": HTTP ${attachRes.status}`);
          }
        } catch (attachError) {
          console.error(`Error fetching attachments for card "${cardName}":`, attachError);
        }

        if (isUpdate) {
          summary.updated++;
          summary.details.push({ cardName, status: 'updated' });
        } else {
          summary.imported++;
          summary.details.push({ cardName, status: 'imported' });
        }
      } catch (cardError) {
        console.error(`Error importing card "${cardName}":`, cardError);
        summary.failed++;
        summary.details.push({
          cardName,
          status: 'failed',
          reason: cardError instanceof Error ? cardError.message : 'Unknown error',
        });
      }
    }

    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    console.error('Error importing batch:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
