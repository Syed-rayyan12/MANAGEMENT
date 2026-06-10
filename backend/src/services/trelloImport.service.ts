import { randomUUID } from 'crypto';
import path from 'path';
import prisma from '../lib/prisma';
import { uploadToR2, getPublicUrl, deleteFromR2 } from '../utils/r2';

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25 MB

// Only one import may run at a time (single-instance deployment).
let activeRunId: string | null = null;

interface ImportParams {
  apiKey: string;
  token: string;
  trelloBoardId: string;
  userId: string;
}

interface CardDetail {
  cardName: string;
  status: 'imported' | 'updated' | 'skipped' | 'failed';
  reason?: string;
}

interface RunSummary {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  commentsImported: number;
  commentsFailed: number;
  attachmentsImported: number;
  attachmentsFailed: number;
  newBoards: string[];
  details: CardDetail[];
}

interface CardResult {
  status: 'imported' | 'updated' | 'skipped';
  commentsImported: number;
  commentsFailed: number;
  attachmentsImported: number;
  attachmentsFailed: number;
  newBoards: string[];
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, retries = 1): Promise<globalThis.Response> {
  const res = await fetch(url);
  if (res.status === 429 && retries > 0) {
    console.warn('Trello rate limit hit, retrying in 2s...');
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
 * Mark any runs left RUNNING by a previous process as failed.
 * Called once at app startup — credentials are never persisted, so an
 * interrupted run cannot resume. Incremental sync makes re-runs cheap.
 */
export async function failInterruptedRuns(): Promise<void> {
  try {
    const result = await prisma.trelloImportRun.updateMany({
      where: { status: 'RUNNING' },
      data: {
        status: 'FAILED',
        error: 'Interrupted by server restart — run the import again (already-synced cards are skipped)',
        finishedAt: new Date(),
      },
    });
    if (result.count > 0) {
      console.warn(`Marked ${result.count} interrupted Trello import run(s) as failed`);
    }
  } catch (error) {
    console.error('Failed to clean up interrupted Trello import runs:', error);
  }
}

export function isImportActive(): boolean {
  return activeRunId !== null;
}

/**
 * Create an import run and start processing in the background.
 * Returns the run id immediately; progress is read via the run row.
 */
export async function startImportRun(params: ImportParams): Promise<string> {
  if (activeRunId) {
    throw new Error('An import is already running');
  }

  const run = await prisma.trelloImportRun.create({
    data: {
      trelloBoardId: params.trelloBoardId,
      createdById: params.userId,
    },
  });

  activeRunId = run.id;

  processImport(run.id, params)
    .catch(async (error) => {
      console.error('Trello import run failed:', error);
      try {
        await prisma.trelloImportRun.update({
          where: { id: run.id },
          data: {
            status: 'FAILED',
            error: error instanceof Error ? error.message : 'Unknown error',
            finishedAt: new Date(),
          },
        });
      } catch (updateError) {
        console.error('Failed to mark Trello import run as failed:', updateError);
      }
    })
    .finally(() => {
      activeRunId = null;
    });

  return run.id;
}

async function processImport(runId: string, params: ImportParams): Promise<void> {
  const { apiKey, token, trelloBoardId, userId } = params;

  const response = await fetchWithRetry(
    `https://api.trello.com/1/boards/${trelloBoardId}?lists=all&cards=all&card_fields=name,desc,labels,due,idList,closed,dateLastActivity&key=${apiKey}&token=${token}`
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Trello API error: ${errorText}`);
  }

  const boardData: any = await response.json();
  const cards = (boardData.cards || []).filter((card: any) => !card.closed);

  const listMap = new Map<string, string>();
  for (const list of boardData.lists || []) {
    listMap.set(list.id, list.name);
  }

  const firstTeam = await prisma.team.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!firstTeam) throw new Error('No teams found');

  const firstOrg = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!firstOrg) throw new Error('No organization found');

  const boardCache = new Map<string, string>();
  const existingBoards = await prisma.board.findMany({ where: { deletedAt: null } });
  for (const board of existingBoards) {
    boardCache.set(board.slug, board.id);
  }

  await prisma.trelloImportRun.update({
    where: { id: runId },
    data: { totalCards: cards.length },
  });

  const summary: RunSummary = {
    imported: 0, updated: 0, skipped: 0, failed: 0,
    commentsImported: 0, commentsFailed: 0,
    attachmentsImported: 0, attachmentsFailed: 0,
    newBoards: [], details: [],
  };

  let processed = 0;

  for (const card of cards) {
    const cardName: string = card.name || 'Untitled';

    let result: CardResult | null = null;
    let lastError: unknown = null;

    // One retry per card — transient Trello/R2/network hiccups shouldn't kill the run
    for (let attempt = 0; attempt < 2 && !result; attempt++) {
      try {
        if (attempt > 0) await delay(2000);
        result = await processCard(card, listMap, {
          apiKey, token, userId,
          teamId: firstTeam.id,
          organizationId: firstOrg.id,
          boardCache,
        });
      } catch (cardError) {
        lastError = cardError;
        console.error(`Error importing card "${cardName}" (attempt ${attempt + 1}):`, cardError);
      }
    }

    if (result) {
      summary[result.status]++;
      summary.commentsImported += result.commentsImported;
      summary.commentsFailed += result.commentsFailed;
      summary.attachmentsImported += result.attachmentsImported;
      summary.attachmentsFailed += result.attachmentsFailed;
      for (const nb of result.newBoards) {
        if (!summary.newBoards.includes(nb)) summary.newBoards.push(nb);
      }
      summary.details.push({ cardName, status: result.status });
    } else {
      summary.failed++;
      summary.details.push({
        cardName,
        status: 'failed',
        reason: lastError instanceof Error ? lastError.message : 'Unknown error',
      });
    }

    processed++;

    await prisma.trelloImportRun.update({
      where: { id: runId },
      data: {
        processedCards: processed,
        imported: summary.imported,
        updated: summary.updated,
        skipped: summary.skipped,
        failed: summary.failed,
        commentsImported: summary.commentsImported,
        commentsFailed: summary.commentsFailed,
        attachmentsImported: summary.attachmentsImported,
        attachmentsFailed: summary.attachmentsFailed,
        newBoards: summary.newBoards,
        details: summary.details as any,
      },
    });
  }

  await prisma.trelloImportRun.update({
    where: { id: runId },
    data: { status: 'COMPLETED', finishedAt: new Date() },
  });
}

interface CardContext {
  apiKey: string;
  token: string;
  userId: string;
  teamId: string;
  organizationId: string;
  boardCache: Map<string, string>;
}

async function processCard(
  card: any,
  listMap: Map<string, string>,
  ctx: CardContext,
): Promise<CardResult> {
  const cardName: string = card.name || 'Untitled';
  const trelloCardId: string = card.id;
  const cardLastActivity = card.dateLastActivity ? new Date(card.dateLastActivity) : null;

  const result: CardResult = {
    status: 'imported',
    commentsImported: 0,
    commentsFailed: 0,
    attachmentsImported: 0,
    attachmentsFailed: 0,
    newBoards: [],
  };

  const existing = await prisma.project.findUnique({
    where: { trelloCardId },
    include: { attachments: true },
  });

  // Incremental sync: skip cards that haven't changed since the last full sync
  if (
    existing &&
    existing.trelloLastActivity &&
    cardLastActivity &&
    cardLastActivity.getTime() <= existing.trelloLastActivity.getTime()
  ) {
    result.status = 'skipped';
    return result;
  }

  const listName = listMap.get(card.idList) || '';
  const boardSlug = detectBoardSlug(listName, cardName);

  let boardId = ctx.boardCache.get(boardSlug);
  if (!boardId) {
    const boardDisplayName = boardSlug
      .split('-')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    const newBoard = await prisma.board.create({
      data: {
        name: boardDisplayName,
        slug: boardSlug,
        organizationId: ctx.organizationId,
        columns: {
          create: DEFAULT_COLUMNS.map((col) => ({
            name: col.name, key: col.key, position: col.position, phase: col.phase,
          })),
        },
      },
    });

    boardId = newBoard.id;
    ctx.boardCache.set(boardSlug, boardId);
    result.newBoards.push(boardDisplayName);
  }

  const labels: any[] = card.labels || [];
  const hasUrgent = labels.some((l: any) => l.name && l.name.toLowerCase().includes('urgent'));
  const priority = hasUrgent ? 'HIGH' : 'MEDIUM';

  let projectId: string;

  if (existing) {
    result.status = 'updated';
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
        teamId: ctx.teamId,
        trelloCardId,
      },
    });
    projectId = newProject.id;
  }

  // --- Import comments ---
  try {
    const cardCommentsRes = await fetchWithRetry(
      `https://api.trello.com/1/cards/${trelloCardId}/actions?filter=commentCard&limit=1000&key=${ctx.apiKey}&token=${ctx.token}`
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
            userId: ctx.userId,
            createdAt: new Date(action.date),
          },
        });
        result.commentsImported++;
      }
    } else {
      console.error(`Comments API failed for "${cardName}": HTTP ${cardCommentsRes.status}`);
      result.commentsFailed++;
    }
  } catch (commentError) {
    console.error(`Error fetching comments for card "${cardName}":`, commentError);
    result.commentsFailed++;
  }

  // --- Import attachments ---
  try {
    const attachRes = await fetchWithRetry(
      `https://api.trello.com/1/cards/${trelloCardId}/attachments?key=${ctx.apiKey}&token=${ctx.token}`
    );
    if (attachRes.ok) {
      const attachments = (await attachRes.json()) as any[];
      const uploadable = attachments.filter((a: any) =>
        a.isUpload !== false && a.bytes > 0 && a.bytes <= MAX_ATTACHMENT_SIZE
      );

      for (const att of uploadable) {
        try {
          const fileBuffer = await downloadTrelloFile(
            trelloCardId, att.id, att.name || 'attachment', ctx.apiKey, ctx.token
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
          result.attachmentsImported++;
        } catch (attError) {
          console.error(`Error importing attachment "${att.name}" for "${cardName}":`, attError);
          result.attachmentsFailed++;
        }
      }
    } else {
      console.error(`Attachments API failed for "${cardName}": HTTP ${attachRes.status}`);
    }
  } catch (attachError) {
    console.error(`Error fetching attachments for card "${cardName}":`, attachError);
  }

  // Only mark the card fully synced once comments + attachments are done,
  // so an interrupted card is re-processed instead of skipped next run
  await prisma.project.update({
    where: { id: projectId },
    data: { trelloLastActivity: cardLastActivity },
  });

  return result;
}
