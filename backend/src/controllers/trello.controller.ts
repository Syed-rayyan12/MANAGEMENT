import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import prisma from '../lib/prisma';
import { uploadToR2, getPublicUrl, deleteFromR2 } from '../utils/r2';

const AUTHORIZED_USERNAME = 'prod.tahiranwar';
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25 MB

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
  // Use Trello's REST API download endpoint — CDN URLs don't accept key/token
  const apiUrl = `https://api.trello.com/1/cards/${cardId}/attachments/${attachmentId}/download/${encodeURIComponent(fileName)}?key=${apiKey}&token=${token}`;
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Check if the requesting user is authorized for Trello operations.
 * Only prod.tahiranwar is allowed.
 */
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
 * Board slug mapping based on Trello list name keywords.
 */
function detectBoardSlug(listName: string, cardName: string): string {
  const lower = listName.toLowerCase();

  // Logo detection
  if (lower.includes('logo')) return 'logo-design';

  // Development detection (before generic "design" check)
  if (lower.includes('development') || lower.includes('dev')) return 'web-development';

  // "Delivered" lists — disambiguate by sub-keyword
  if (lower.includes('delivered')) {
    if (lower.includes('live')) return 'web-development';
    if (lower.includes('design')) return 'web-design';
  }

  // Website design / design (but not logo or development)
  if (lower.includes('website design') || lower.includes('design')) return 'web-design';

  // SEO
  if (lower.includes('seo')) return 'seo';

  // Content
  if (lower.includes('content')) return 'content';

  // Social media
  if (lower.includes('social media')) return 'social-media';

  // Ambiguous lists (Disputed, Rush Revision, etc.) — detect from card name prefix
  const cardLower = cardName.toLowerCase();
  if (cardLower.startsWith('logo:')) return 'logo-design';
  if (cardLower.startsWith('website:')) return 'web-design';

  // Fallback
  return 'web-design';
}

/** Default columns for auto-created boards */
const DEFAULT_COLUMNS = [
  { name: 'Todo', key: 'todo', position: 0, phase: 'NOT_STARTED' as const },
  { name: 'In Progress', key: 'in-progress', position: 1, phase: 'IN_PROGRESS' as const },
  { name: 'Completed', key: 'completed', position: 2, phase: 'DONE' as const },
  { name: 'Revisions', key: 'revisions', position: 3, phase: 'IN_PROGRESS' as const },
];

/**
 * Import cards from a Trello board into XRM (SSE streaming).
 * POST /api/trello/import
 *
 * Streams progress events to the client:
 *   event: progress  — per-card status update
 *   event: complete  — final summary
 *   event: error     — fatal error
 */
export const importFromTrello = async (req: Request, res: Response): Promise<void> => {
  // --- Auth & validation (JSON errors before switching to SSE) ---
  const authorized = await checkTrelloAuth(req, res);
  if (!authorized) return;

  const { apiKey, token, trelloBoardId } = req.body as {
    apiKey?: string;
    token?: string;
    trelloBoardId?: string;
  };

  if (!apiKey || !token || !trelloBoardId) {
    res.status(400).json({ success: false, message: 'apiKey, token, and trelloBoardId are required' });
    return;
  }

  // --- Switch to SSE ---
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Fetch board data from Trello
    sendEvent('progress', { message: 'Fetching board data from Trello...' });

    const response = await fetch(
      `https://api.trello.com/1/boards/${trelloBoardId}?lists=all&cards=all&card_fields=name,desc,labels,due,idList,closed&key=${apiKey}&token=${token}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      sendEvent('error', { message: `Trello API error: ${errorText}` });
      res.end();
      return;
    }

    const boardData: any = await response.json();

    const listMap = new Map<string, string>();
    for (const list of boardData.lists || []) {
      listMap.set(list.id, list.name);
    }

    const openCards = (boardData.cards || []).filter((card: any) => !card.closed);
    const totalCards = openCards.length;

    sendEvent('progress', { message: `Found ${totalCards} cards to process`, total: totalCards, current: 0 });

    const firstTeam = await prisma.team.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!firstTeam) {
      sendEvent('error', { message: 'No teams found in the system' });
      res.end();
      return;
    }

    const firstOrg = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!firstOrg) {
      sendEvent('error', { message: 'No organization found in the system' });
      res.end();
      return;
    }

    const importingUserId = (req as any).user?.id;

    const boardCache = new Map<string, string>();
    const newBoardsCreated: string[] = [];

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

    for (let i = 0; i < openCards.length; i++) {
      const card = openCards[i];
      const cardName: string = card.name || 'Untitled';
      const trelloCardId: string = card.id;

      sendEvent('progress', {
        message: `Processing: ${cardName}`,
        current: i + 1,
        total: totalCards,
        cardName,
      });

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
                  name: col.name,
                  key: col.key,
                  position: col.position,
                  phase: col.phase,
                })),
              },
            },
          });

          boardId = newBoard.id;
          boardCache.set(boardSlug, boardId);
          newBoardsCreated.push(boardDisplayName);
          summary.newBoards.push(boardDisplayName);
        }

        const labels: any[] = card.labels || [];
        const hasUrgent = labels.some(
          (l: any) => l.name && l.name.toLowerCase().includes('urgent')
        );
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
                const commentContent = `**${memberName}** (from Trello):\n${text}`;
                await prisma.comment.create({
                  data: {
                    content: commentContent,
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

            for (let ai = 0; ai < uploadable.length; ai++) {
              const att = uploadable[ai];
              try {
                const attachmentId: string = att.id;
                const fileSize: number = att.bytes || 0;
                const fileName: string = att.name || 'attachment';
                const mimeType: string = att.mimeType || 'application/octet-stream';

                // Send per-attachment event to keep connection alive
                sendEvent('progress', {
                  message: `${cardName} — downloading ${fileName} (${ai + 1}/${uploadable.length})`,
                  current: i + 1,
                  total: totalCards,
                  cardName,
                });

                const fileBuffer = await downloadTrelloFile(trelloCardId, attachmentId, fileName, apiKey, token);

                const ext = path.extname(fileName) || '.bin';
                const r2Key = `trello-imports/${randomUUID()}${ext}`;

                await uploadToR2(r2Key, fileBuffer, mimeType);
                const publicUrl = getPublicUrl(r2Key);

                await prisma.attachment.create({
                  data: {
                    filename: fileName,
                    url: publicUrl,
                    key: r2Key,
                    type: mimeType.split('/')[0] || 'file',
                    size: fileSize,
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

    sendEvent('complete', {
      success: true,
      message: `Import complete: ${summary.imported} imported, ${summary.updated} updated, ${summary.skipped} skipped, ${summary.failed} failed`,
      data: summary,
    });
  } catch (error) {
    console.error('Error importing from Trello:', error);
    sendEvent('error', { message: 'Internal server error' });
  } finally {
    res.end();
  }
};
