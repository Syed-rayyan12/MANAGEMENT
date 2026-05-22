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

async function downloadTrelloFile(url: string, apiKey: string, token: string): Promise<Buffer> {
  let res = await fetch(url);
  if (res.status === 401 || res.status === 403) {
    const sep = url.includes('?') ? '&' : '?';
    res = await fetch(`${url}${sep}key=${apiKey}&token=${token}`);
  }
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
 * Import cards from a Trello board into XRM.
 * POST /api/trello/import
 */
export const importFromTrello = async (req: Request, res: Response): Promise<void> => {
  try {
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

    // Fetch board data from Trello
    const response = await fetch(
      `https://api.trello.com/1/boards/${trelloBoardId}?lists=all&cards=all&card_fields=name,desc,labels,due,idList,closed&key=${apiKey}&token=${token}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      res.status(400).json({
        success: false,
        message: `Trello API error: ${errorText}`,
      });
      return;
    }

    const boardData: any = await response.json();

    // Build list ID → list name map
    const listMap = new Map<string, string>();
    for (const list of boardData.lists || []) {
      listMap.set(list.id, list.name);
    }

    // Filter out closed cards
    const openCards = (boardData.cards || []).filter((card: any) => !card.closed);

    // Get the first team for assignment
    const firstTeam = await prisma.team.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!firstTeam) {
      res.status(500).json({ success: false, message: 'No teams found in the system' });
      return;
    }

    // Get the first organization for board creation
    const firstOrg = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!firstOrg) {
      res.status(500).json({ success: false, message: 'No organization found in the system' });
      return;
    }

    // Get the importing user's ID for comment attribution
    const importingUserId = (req as any).user?.id;

    // Cache for board lookups / creations
    const boardCache = new Map<string, string>(); // slug → boardId
    const newBoardsCreated: string[] = [];

    // Pre-load existing boards
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

    for (const card of openCards) {
      const cardName: string = card.name || 'Untitled';
      const trelloCardId: string = card.id;

      try {
        // Check for existing project (update instead of skip)
        const existing = await prisma.project.findUnique({
          where: { trelloCardId },
          include: { attachments: true },
        });

        // Detect target board
        const listName = listMap.get(card.idList) || '';
        const boardSlug = detectBoardSlug(listName, cardName);

        // Get or create board
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

        // Determine priority from labels
        const labels: any[] = card.labels || [];
        const hasUrgent = labels.some(
          (l: any) => l.name && l.name.toLowerCase().includes('urgent')
        );
        const priority = hasUrgent ? 'HIGH' : 'MEDIUM';

        let projectId: string;
        let isUpdate = false;

        if (existing) {
          // Update existing project
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

          // Delete existing comments (will re-import from Trello)
          await prisma.comment.deleteMany({ where: { projectId } });

          // Delete existing attachments from R2 + DB
          for (const att of existing.attachments) {
            if (att.key) {
              try { await deleteFromR2(att.key); } catch { /* ignore R2 delete errors */ }
            }
          }
          await prisma.attachment.deleteMany({ where: { projectId } });
        } else {
          // Create new project
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

        // --- Import comments from Trello ---
        if (importingUserId) {
          try {
            await delay(100); // rate-limit protection
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

        // --- Import attachments from Trello ---
        try {
          await delay(100);
          const attachRes = await fetchWithRetry(
            `https://api.trello.com/1/cards/${trelloCardId}/attachments?key=${apiKey}&token=${token}`
          );
          if (attachRes.ok) {
            const attachments = (await attachRes.json()) as any[];
            for (const att of attachments) {
              try {
                const fileUrl: string = att.url;
                const fileSize: number = att.bytes || 0;
                const fileName: string = att.name || 'attachment';
                const mimeType: string = att.mimeType || 'application/octet-stream';

                // Skip non-file attachments (e.g. link-only) and oversized files
                if (!fileUrl || fileSize === 0 || fileSize > MAX_ATTACHMENT_SIZE) continue;

                await delay(100);
                const fileBuffer = await downloadTrelloFile(fileUrl, apiKey, token);

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

    res.status(200).json({
      success: true,
      message: `Import complete: ${summary.imported} imported, ${summary.updated} updated, ${summary.skipped} skipped, ${summary.failed} failed`,
      data: summary,
    });
  } catch (error) {
    console.error('Error importing from Trello:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
