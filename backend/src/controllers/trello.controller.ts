import { Request, Response } from 'express';
import prisma from '../lib/prisma';

const AUTHORIZED_USERNAME = 'prod.tahiranwar';

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

    // Fetch all comments from the board (paginated, up to 1000)
    const commentsResponse = await fetch(
      `https://api.trello.com/1/boards/${trelloBoardId}/actions?filter=commentCard&limit=1000&key=${apiKey}&token=${token}`
    );
    const trelloComments: any[] = commentsResponse.ok ? (await commentsResponse.json()) as any[] : [];

    // Group comments by card ID
    const commentsByCard = new Map<string, { text: string; memberName: string; date: string }[]>();
    for (const action of trelloComments) {
      const cardId = action.data?.card?.id;
      if (!cardId) continue;
      const list = commentsByCard.get(cardId) || [];
      list.push({
        text: action.data?.text || '',
        memberName: action.memberCreator?.fullName || action.memberCreator?.username || 'Unknown',
        date: action.date,
      });
      commentsByCard.set(cardId, list);
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
      skipped: 0,
      failed: 0,
      newBoards: [] as string[],
      details: [] as { cardName: string; status: string; reason?: string }[],
    };

    for (const card of openCards) {
      const cardName: string = card.name || 'Untitled';
      const trelloCardId: string = card.id;

      try {
        // Check for duplicate
        const existing = await prisma.project.findUnique({ where: { trelloCardId } });
        if (existing) {
          summary.skipped++;
          summary.details.push({ cardName, status: 'skipped', reason: 'Already imported' });
          continue;
        }

        // Detect target board
        const listName = listMap.get(card.idList) || '';
        const boardSlug = detectBoardSlug(listName, cardName);

        // Get or create board
        let boardId = boardCache.get(boardSlug);
        if (!boardId) {
          // Auto-create the board
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

        // Create the project
        const newProject = await prisma.project.create({
          data: {
            name: cardName,
            description: card.desc || null,
            status: 'todo',
            priority,
            dueDate: card.due ? new Date(card.due) : null,
            boardId,
            teamId: firstTeam.id,
            trelloCardId,
          },
        });

        // Import comments for this card
        const cardComments = commentsByCard.get(trelloCardId) || [];
        if (cardComments.length > 0 && importingUserId) {
          // Sort oldest first so they appear in chronological order
          cardComments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          for (const c of cardComments) {
            const commentContent = `**${c.memberName}** (from Trello):\n${c.text}`;
            await prisma.comment.create({
              data: {
                content: commentContent,
                projectId: newProject.id,
                userId: importingUserId,
                createdAt: new Date(c.date),
              },
            });
          }
        }

        summary.imported++;
        summary.details.push({ cardName, status: 'imported' });
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
      message: `Import complete: ${summary.imported} imported, ${summary.skipped} skipped, ${summary.failed} failed`,
      data: summary,
    });
  } catch (error) {
    console.error('Error importing from Trello:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
