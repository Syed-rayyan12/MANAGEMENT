# Trello Import Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a permanent Trello import feature to XRM, restricted to `prod.tahiranwar`, that imports Trello cards as projects with duplicate detection.

**Architecture:** New backend controller/route for Trello API proxy + import logic. New frontend page at `/dashboard/import`. Schema migration adds `trelloCardId` to Project. Authorization check uses DB lookup by `req.user.id` since JWT doesn't carry username. Frontend sidebar check requires adding `username` to login response and `CurrentUser` type.

**Tech Stack:** Express.js, Prisma, Zod, Next.js App Router, shadcn/ui, Trello REST API

---

### Task 1: Add `username` to auth login response and frontend types

The JWT token and login response don't include `username`. We need it for frontend authorization checks (sidebar visibility). The backend trello controller will look up username via `req.user.id`.

**Files:**
- Modify: `backend/src/controllers/auth.controller.ts:81-93` (add username to login response)
- Modify: `frontend/lib/types.ts:1` (add username to CurrentUser interface)

- [ ] **Step 1: Add username to login response**

In `backend/src/controllers/auth.controller.ts`, update the response at line 81 to include `username`:

```typescript
res.status(200).json({
  success: true,
  message: 'Login successful',
  data: {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      name: user.name,
      teams,
    },
    token,
  },
});
```

- [ ] **Step 2: Add username to CurrentUser interface**

In `frontend/lib/types.ts`, update the `CurrentUser` interface:

```typescript
export interface CurrentUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role?: string;
  avatar?: string;
  teams?: TeamInfo[];
  specialization?: Specialization;
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/auth.controller.ts frontend/lib/types.ts
git commit -m "feat: add username to login response and CurrentUser type

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Add `trelloCardId` to Prisma schema and migrate

**Files:**
- Modify: `backend/prisma/schema.prisma:192-232` (add trelloCardId to Project model)

- [ ] **Step 1: Add trelloCardId field to Project model**

In `backend/prisma/schema.prisma`, add to the Project model after the `position` field (around line 200):

```prisma
model Project {
  id          String          @id @default(uuid())
  name        String
  status      String          @default("todo") // references BoardColumn.key
  priority    ProjectPriority @default(MEDIUM)
  description String?
  dueDate     DateTime?
  image       String?
  position    Int             @default(0)
  trelloCardId String?        @unique // Trello card ID for duplicate detection

  // Board relation (which service board: logo, web design, etc.)
  boardId     String
  board       Board           @relation(fields: [boardId], references: [id], onDelete: Cascade)

  // ... rest unchanged
```

- [ ] **Step 2: Generate migration**

Run:
```bash
cd backend && npx prisma migrate dev --name add_trello_card_id
```

Expected: Migration created successfully, Prisma client regenerated.

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add trelloCardId field to Project model for import dedup

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Create Trello controller

**Files:**
- Create: `backend/src/controllers/trello.controller.ts`

- [ ] **Step 1: Create the controller file**

Create `backend/src/controllers/trello.controller.ts`:

```typescript
import { Request, Response } from 'express';
import prisma from '../lib/prisma';

const TRELLO_API = 'https://api.trello.com/1';

/**
 * Check if the authenticated user is prod.tahiranwar
 */
async function isAuthorizedImporter(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });
  return user?.username === 'prod.tahiranwar';
}

/**
 * Board mapping: Trello list name → XRM board slug
 */
function detectBoardSlug(listName: string, cardName: string): string {
  const list = listName.toLowerCase();
  const card = cardName.toLowerCase();

  // Match by list name first
  if (list.includes('logo')) return 'logo-design';
  if (list.includes('website design') || list.includes('homepage')) return 'web-design';
  if (list.includes('design') && !list.includes('logo') && !list.includes('development')) return 'web-design';
  if (list.includes('development') || list.includes('dev')) return 'web-development';
  if (list.includes('delivered') && list.includes('live')) return 'web-development';
  if (list.includes('delivered') && list.includes('design')) return 'web-design';
  if (list.includes('seo')) return 'seo';
  if (list.includes('content')) return 'content';
  if (list.includes('social media')) return 'social-media';

  // Ambiguous lists (Disputed, Rush Revision) — detect from card name prefix
  if (card.startsWith('logo:') || card.startsWith('logo ')) return 'logo-design';
  if (card.startsWith('website:') || card.startsWith('website ')) return 'web-development';
  if (card.startsWith('seo')) return 'seo';

  // Fallback
  return 'web-design';
}

/**
 * GET /api/trello/boards
 * Fetch available Trello boards for the authenticated user
 */
export const getTrelloBoards = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || !(await isAuthorizedImporter(req.user.id))) {
      res.status(403).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { apiKey, token } = req.query;
    if (!apiKey || !token) {
      res.status(400).json({ success: false, message: 'apiKey and token are required' });
      return;
    }

    const url = `${TRELLO_API}/members/me/boards?fields=name,id,url&key=${apiKey}&token=${token}`;
    const response = await fetch(url);

    if (!response.ok) {
      res.status(response.status).json({
        success: false,
        message: 'Failed to fetch Trello boards. Check your API key and token.',
      });
      return;
    }

    const boards = await response.json();

    res.json({
      success: true,
      message: 'Trello boards fetched',
      data: { boards },
    });
  } catch (error) {
    console.error('Trello boards error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * POST /api/trello/import
 * Import cards from a Trello board as XRM projects
 */
export const importFromTrello = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || !(await isAuthorizedImporter(req.user.id))) {
      res.status(403).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { apiKey, token, trelloBoardId } = req.body;
    if (!apiKey || !token || !trelloBoardId) {
      res.status(400).json({ success: false, message: 'apiKey, token, and trelloBoardId are required' });
      return;
    }

    // 1. Fetch board data from Trello
    const url = `${TRELLO_API}/boards/${trelloBoardId}?lists=all&cards=all&card_fields=name,desc,labels,due,idList,closed&key=${apiKey}&token=${token}`;
    const response = await fetch(url);

    if (!response.ok) {
      res.status(response.status).json({
        success: false,
        message: 'Failed to fetch Trello board data.',
      });
      return;
    }

    const boardData = await response.json();
    const trelloLists: Array<{ id: string; name: string }> = boardData.lists || [];
    const trelloCards: Array<{
      id: string;
      name: string;
      desc: string;
      labels: Array<{ name: string }>;
      due: string | null;
      idList: string;
      closed: boolean;
    }> = boardData.cards || [];

    // Build list ID → name map
    const listMap = new Map<string, string>();
    for (const list of trelloLists) {
      listMap.set(list.id, list.name);
    }

    // 2. Filter out closed cards
    const openCards = trelloCards.filter(c => !c.closed);

    // 3. Get existing trelloCardIds for dedup
    const existingIds = new Set(
      (await prisma.project.findMany({
        where: { trelloCardId: { not: null } },
        select: { trelloCardId: true },
      })).map(p => p.trelloCardId)
    );

    // 4. Get the single team
    const team = await prisma.team.findFirst();
    if (!team) {
      res.status(500).json({ success: false, message: 'No team found. Run seed first.' });
      return;
    }

    // 5. Get organization for board creation
    const org = await prisma.organization.findFirst();
    if (!org) {
      res.status(500).json({ success: false, message: 'No organization found. Run seed first.' });
      return;
    }

    // 6. Resolve or create XRM boards
    const defaultColumns = [
      { name: 'To Do', key: 'todo', color: '#6B7280', position: 0, phase: 'NOT_STARTED' as const },
      { name: 'In Progress', key: 'in-progress', color: '#3B82F6', position: 1, phase: 'IN_PROGRESS' as const },
      { name: 'Completed', key: 'completed', color: '#10B981', position: 2, phase: 'DONE' as const },
      { name: 'Revisions', key: 'revisions', color: '#F59E0B', position: 3, phase: 'IN_PROGRESS' as const },
    ];

    const boardCache = new Map<string, string>(); // slug → id
    const newBoardsCreated: string[] = [];

    async function resolveBoardId(slug: string): Promise<string> {
      if (boardCache.has(slug)) return boardCache.get(slug)!;

      let board = await prisma.board.findUnique({ where: { slug } });
      if (!board) {
        // Auto-create board with default columns
        const nameMap: Record<string, string> = {
          'logo-design': 'Logo Design',
          'web-design': 'Web Design',
          'web-development': 'Web Development',
          'content': 'Content Creation',
          'seo': 'SEO',
          'social-media': 'Social Media',
        };
        board = await prisma.board.create({
          data: {
            name: nameMap[slug] || slug,
            slug,
            organizationId: org!.id,
            columns: { create: defaultColumns },
          },
        });
        newBoardsCreated.push(board.name);
      }
      boardCache.set(slug, board.id);
      return board.id;
    }

    // 7. Import cards
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const details: Array<{ name: string; board: string; status: 'imported' | 'skipped' | 'failed' }> = [];

    for (const card of openCards) {
      // Dedup check
      if (existingIds.has(card.id)) {
        skipped++;
        details.push({ name: card.name, board: '', status: 'skipped' });
        continue;
      }

      try {
        const listName = listMap.get(card.idList) || 'Unknown';
        const boardSlug = detectBoardSlug(listName, card.name);
        const boardId = await resolveBoardId(boardSlug);

        // Detect priority from labels
        const hasUrgent = card.labels?.some(l => l.name?.toLowerCase() === 'urgent');
        const priority = hasUrgent ? 'HIGH' : 'MEDIUM';

        await prisma.project.create({
          data: {
            name: card.name,
            description: card.desc || '',
            status: 'todo',
            priority: priority as any,
            dueDate: card.due ? new Date(card.due) : null,
            boardId,
            teamId: team.id,
            trelloCardId: card.id,
          },
        });

        const boardName = (await prisma.board.findUnique({ where: { id: boardId }, select: { name: true } }))?.name || boardSlug;
        imported++;
        details.push({ name: card.name, board: boardName, status: 'imported' });
      } catch (err) {
        console.error(`Failed to import card "${card.name}":`, err);
        failed++;
        details.push({ name: card.name, board: '', status: 'failed' });
      }
    }

    res.json({
      success: true,
      message: `Import completed: ${imported} imported, ${skipped} skipped, ${failed} failed`,
      data: {
        imported,
        skipped,
        failed,
        newBoards: newBoardsCreated,
        details,
      },
    });
  } catch (error) {
    console.error('Trello import error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/controllers/trello.controller.ts
git commit -m "feat: add Trello import controller with board mapping and dedup

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Create Trello route and register in app.ts

**Files:**
- Create: `backend/src/routes/trello.routes.ts`
- Modify: `backend/src/app.ts:8-21,141-154` (import and register route)

- [ ] **Step 1: Create the route file**

Create `backend/src/routes/trello.routes.ts`:

```typescript
import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { getTrelloBoards, importFromTrello } from '../controllers/trello.controller';

const router = Router();

router.get('/boards', authenticate, getTrelloBoards);
router.post('/import', authenticate, importFromTrello);

export default router;
```

- [ ] **Step 2: Register route in app.ts**

In `backend/src/app.ts`, add the import after the existing route imports (around line 21):

```typescript
import trelloRoutes from './routes/trello.routes';
```

Add the route mount after the existing routes (around line 154):

```typescript
app.use('/api/trello', apiLimiter, trelloRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/trello.routes.ts backend/src/app.ts
git commit -m "feat: add Trello API routes and register in app

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Add trelloAPI to frontend api-service

**Files:**
- Modify: `frontend/lib/api-service.ts` (add trelloAPI object at end of file)

- [ ] **Step 1: Add trelloAPI to api-service.ts**

Add the following at the end of `frontend/lib/api-service.ts`, before the file ends:

```typescript
// Trello Import APIs
export const trelloAPI = {
  getBoards: async (apiKey: string, token: string) => {
    const response = await apiFetch(
      `${API_BASE_URL}/trello/boards?apiKey=${encodeURIComponent(apiKey)}&token=${encodeURIComponent(token)}`
    );
    return await response.json();
  },

  import: async (apiKey: string, token: string, trelloBoardId: string) => {
    const response = await apiFetch(`${API_BASE_URL}/trello/import`, {
      method: 'POST',
      body: JSON.stringify({ apiKey, token, trelloBoardId }),
    });
    return await response.json();
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/api-service.ts
git commit -m "feat: add trelloAPI to frontend api-service

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Create the Trello Import frontend page

**Files:**
- Create: `frontend/app/dashboard/import/page.tsx`

- [ ] **Step 1: Create the import page**

Create `frontend/app/dashboard/import/page.tsx`:

```tsx
'use client';

import React, { useState } from 'react';
import { useApp } from '@/contexts/useApp';
import { trelloAPI } from '@/lib/api-service';
import { useRouter } from 'next/navigation';
import { Upload, Loader2, CheckCircle2, XCircle, SkipForward } from 'lucide-react';

interface TrelloBoard {
  id: string;
  name: string;
  url: string;
}

interface ImportDetail {
  name: string;
  board: string;
  status: 'imported' | 'skipped' | 'failed';
}

interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  newBoards: string[];
  details: ImportDetail[];
}

export default function TrelloImportPage() {
  const { state } = useApp();
  const router = useRouter();

  // Auth gate
  if (state.currentUser?.username !== 'prod.tahiranwar') {
    router.replace('/dashboard');
    return null;
  }

  const [apiKey, setApiKey] = useState('');
  const [token, setToken] = useState('');
  const [boards, setBoards] = useState<TrelloBoard[]>([]);
  const [selectedBoard, setSelectedBoard] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingBoards, setFetchingBoards] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  const handleFetchBoards = async () => {
    if (!apiKey || !token) {
      setError('Please enter both API Key and Token');
      return;
    }
    setError('');
    setFetchingBoards(true);
    try {
      const res = await trelloAPI.getBoards(apiKey, token);
      if (res.success) {
        setBoards(res.data.boards);
        if (res.data.boards.length === 0) {
          setError('No boards found on this Trello account');
        }
      } else {
        setError(res.message || 'Failed to fetch boards');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch boards');
    } finally {
      setFetchingBoards(false);
    }
  };

  const handleImport = async () => {
    if (!selectedBoard) {
      setError('Please select a board');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const res = await trelloAPI.import(apiKey, token, selectedBoard);
      if (res.success) {
        setResult(res.data);
      } else {
        setError(res.message || 'Import failed');
      }
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-foreground">Trello Import</h1>
          <p className="text-sm text-fg-3 mt-1">
            Import projects from your Trello board into XRM. Duplicate cards are automatically skipped.
          </p>
        </div>

        {/* Step 1: Credentials */}
        <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
          <h2 className="text-sm font-medium text-foreground">1. Connect to Trello</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-fg-3 mb-1 block">API Key</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Your Trello API key"
                className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-fg-4 focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label className="text-xs text-fg-3 mb-1 block">Token</label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Your Trello token"
                className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-fg-4 focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <button
              onClick={handleFetchBoards}
              disabled={fetchingBoards || !apiKey || !token}
              className="px-4 py-2 text-sm font-medium rounded-md bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {fetchingBoards && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Fetch Boards
            </button>
          </div>
        </div>

        {/* Step 2: Select Board */}
        {boards.length > 0 && (
          <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
            <h2 className="text-sm font-medium text-foreground">2. Select Board & Import</h2>
            <div className="space-y-3">
              <select
                value={selectedBoard}
                onChange={(e) => setSelectedBoard(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">Select a board...</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <button
                onClick={handleImport}
                disabled={loading || !selectedBoard}
                className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Import Projects
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
            <h2 className="text-sm font-medium text-foreground">Import Results</h2>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 text-center">
                <p className="text-2xl font-semibold text-green-600 dark:text-green-400">{result.imported}</p>
                <p className="text-xs text-green-600/70 dark:text-green-400/70">Imported</p>
              </div>
              <div className="rounded-md bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 p-3 text-center">
                <p className="text-2xl font-semibold text-yellow-600 dark:text-yellow-400">{result.skipped}</p>
                <p className="text-xs text-yellow-600/70 dark:text-yellow-400/70">Skipped</p>
              </div>
              <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 text-center">
                <p className="text-2xl font-semibold text-red-600 dark:text-red-400">{result.failed}</p>
                <p className="text-xs text-red-600/70 dark:text-red-400/70">Failed</p>
              </div>
            </div>

            {/* New boards created */}
            {result.newBoards.length > 0 && (
              <div className="text-sm text-fg-2">
                <span className="font-medium">New boards created:</span>{' '}
                {result.newBoards.join(', ')}
              </div>
            )}

            {/* Detail table */}
            <div className="max-h-[400px] overflow-y-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-fg-3">Project</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-fg-3">Board</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-fg-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.details.map((d, i) => (
                    <tr key={i} className="hover:bg-surface-2/50">
                      <td className="px-3 py-2 text-foreground truncate max-w-[280px]">{d.name}</td>
                      <td className="px-3 py-2 text-fg-2">{d.board || '—'}</td>
                      <td className="px-3 py-2">
                        {d.status === 'imported' && (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Imported
                          </span>
                        )}
                        {d.status === 'skipped' && (
                          <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                            <SkipForward className="w-3.5 h-3.5" /> Skipped
                          </span>
                        )}
                        {d.status === 'failed' && (
                          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                            <XCircle className="w-3.5 h-3.5" /> Failed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/dashboard/import/page.tsx
git commit -m "feat: add Trello import page at /dashboard/import

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Add Trello Import link to sidebar

**Files:**
- Modify: `frontend/components/layout/Sidebar.tsx:7-17,92-142` (add import icon and nav item)

- [ ] **Step 1: Add import icon to lucide imports**

In `frontend/components/layout/Sidebar.tsx`, update the lucide imports at line 8 to include `ArrowDownToLine`:

```typescript
import {
  LayoutDashboard,
  Briefcase,
  Inbox,
  FileText,
  TrendingUp,
  Trash2,
  Shield,
  Search,
  User,
  ArrowDownToLine,
} from 'lucide-react';
```

- [ ] **Step 2: Add the nav item conditionally**

In `frontend/components/layout/Sidebar.tsx`, add after the trash nav item check (around line 141, before the closing `]` of `navItems`):

```typescript
...(state.currentUser?.username === 'prod.tahiranwar' ? [{
  id: 'import',
  label: 'Trello Import',
  icon: ArrowDownToLine,
  href: '/dashboard/import',
  match: (p: string) => p === '/dashboard/import',
}] : []),
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/layout/Sidebar.tsx
git commit -m "feat: add Trello Import nav item to sidebar for prod.tahiranwar

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Update seed data with real team roster

**Files:**
- Modify: `backend/prisma/seed.ts` (replace teams, users, and sample projects)

- [ ] **Step 1: Rewrite the seed file**

Replace the entire contents of `backend/prisma/seed.ts` with:

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const password = await bcrypt.hash('password123', 10);

  // ─── 1. Create Organization ───────────────────────
  const org = await prisma.organization.upsert({
    where: { id: 'org-xpertwebstudio' },
    update: { name: 'XpertWebStudio' },
    create: { id: 'org-xpertwebstudio', name: 'XpertWebStudio' },
  });
  console.log(`Organization: ${org.name}`);

  // ─── 2. Create Single Team ───────────────────────
  const team = await prisma.team.upsert({
    where: { slug: 'xpert-web-studio' },
    update: { name: 'Xpert Web Studio' },
    create: { id: 'team-xws', name: 'Xpert Web Studio', slug: 'xpert-web-studio', organizationId: org.id },
  });
  console.log(`Team: ${team.name}`);

  // ─── 3. Create Org-Level Boards ──────────────────
  const boardDefs = [
    { id: 'board-logo', name: 'Logo Design', slug: 'logo-design' },
    { id: 'board-webdesign', name: 'Web Design', slug: 'web-design' },
    { id: 'board-webdev', name: 'Web Development', slug: 'web-development' },
    { id: 'board-content', name: 'Content Creation', slug: 'content' },
  ];

  const defaultColumns = [
    { name: 'To Do', key: 'todo', color: '#6B7280', position: 0, phase: 'NOT_STARTED' as const },
    { name: 'In Progress', key: 'in-progress', color: '#3B82F6', position: 1, phase: 'IN_PROGRESS' as const },
    { name: 'Completed', key: 'completed', color: '#10B981', position: 2, phase: 'DONE' as const },
    { name: 'Revisions', key: 'revisions', color: '#F59E0B', position: 3, phase: 'IN_PROGRESS' as const },
  ];

  for (const b of boardDefs) {
    const existing = await prisma.board.findUnique({ where: { slug: b.slug } });
    if (!existing) {
      await prisma.board.create({
        data: {
          id: b.id,
          name: b.name,
          slug: b.slug,
          organizationId: org.id,
          columns: { create: defaultColumns },
        },
      });
    }
    console.log(`Board: ${b.name}`);
  }

  // Add "Live" column to Web Development board
  const webDevBoard = await prisma.board.findUnique({ where: { slug: 'web-development' } });
  if (webDevBoard) {
    const existingLiveCol = await prisma.boardColumn.findUnique({
      where: { boardId_key: { boardId: webDevBoard.id, key: 'live' } },
    });
    if (!existingLiveCol) {
      await prisma.boardColumn.create({
        data: {
          name: 'Live',
          key: 'live',
          color: '#10B981',
          position: 4,
          boardId: webDevBoard.id,
          phase: 'DONE',
        },
      });
      console.log('Added "Live" column to Web Development board');
    }
  }

  // ─── 4. Create Users ─────────────────────────────
  console.log('\nCreating users...');

  const allUsers = [
    // TL
    { username: 'tl.ali', email: 'tl.ali@company.com', password, role: 'TL' as const, name: 'Ali', specialization: null },
    // PMs
    { username: 'pm.rehan', email: 'pm.rehan@company.com', password, role: 'PM' as const, name: 'Rehan', specialization: null },
    { username: 'pm.mujtaba', email: 'pm.mujtaba@company.com', password, role: 'PM' as const, name: 'Mujtaba', specialization: null },
    { username: 'pm.anas', email: 'pm.anas@company.com', password, role: 'PM' as const, name: 'Anas', specialization: null },
    { username: 'pm.aqsa', email: 'pm.aqsa@company.com', password, role: 'PM' as const, name: 'Aqsa', specialization: null },
    // Production
    { username: 'prod.aqsa', email: 'prod.aqsa@company.com', password, role: 'PRODUCTION' as const, name: 'Aqsa', specialization: 'LOGO_DESIGNER' as const },
    { username: 'prod.abubakr', email: 'prod.abubakr@company.com', password, role: 'PRODUCTION' as const, name: 'Abu Bakr', specialization: 'LOGO_DESIGNER' as const },
    { username: 'prod.arshanhasan', email: 'prod.arshanhasan@company.com', password, role: 'PRODUCTION' as const, name: 'Arshan Hasan', specialization: 'FIGMA_DESIGNER' as const },
    { username: 'prod.syedtaha', email: 'prod.syedtaha@company.com', password, role: 'PRODUCTION' as const, name: 'Syed Taha', specialization: 'FIGMA_DESIGNER' as const },
    { username: 'prod.syedrayyan', email: 'prod.syedrayyan@company.com', password, role: 'PRODUCTION' as const, name: 'Syed Rayyan', specialization: 'DEVELOPER' as const },
    { username: 'prod.muslimraza', email: 'prod.muslimraza@company.com', password, role: 'PRODUCTION' as const, name: 'Muslim Raza', specialization: 'DEVELOPER' as const },
    { username: 'prod.qasimrizvi', email: 'prod.qasimrizvi@company.com', password, role: 'PRODUCTION' as const, name: 'Qasim Rizvi', specialization: 'DEVELOPER' as const },
    { username: 'prod.akbar', email: 'prod.akbar@company.com', password, role: 'PRODUCTION' as const, name: 'Akbar', specialization: 'DEVELOPER' as const },
    { username: 'prod.muhammadbinsaud', email: 'prod.muhammadbinsaud@company.com', password, role: 'PRODUCTION' as const, name: 'Muhammad Bin Saud', specialization: 'DEVELOPER' as const },
    { username: 'prod.tahiranwar', email: 'prod.tahiranwar@company.com', password, role: 'PRODUCTION' as const, name: 'Tahir Anwar', specialization: null },
    // Executives
    { username: 'exec.maarijsaud', email: 'exec.maarijsaud@company.com', password, role: 'EXECUTIVE' as const, name: 'Maarij Saud', specialization: null },
    { username: 'exec.khizarfaiz', email: 'exec.khizarfaiz@company.com', password, role: 'EXECUTIVE' as const, name: 'Khizar Faiz', specialization: null },
    { username: 'exec.babarkhan', email: 'exec.babarkhan@company.com', password, role: 'EXECUTIVE' as const, name: 'Babar Khan', specialization: null },
  ];

  for (const u of allUsers) {
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: { name: u.name, ...(u.specialization ? { specialization: u.specialization } : {}) },
      create: {
        username: u.username,
        email: u.email,
        password: u.password,
        role: u.role,
        name: u.name,
        ...(u.specialization ? { specialization: u.specialization } : {}),
      },
    });

    // Add to team
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: user.id } },
      update: {},
      create: { teamId: team.id, userId: user.id },
    });

    console.log(`${u.role}: ${u.name} (${u.username})${u.specialization ? ` [${u.specialization}]` : ''}`);
  }

  // ─── 5. Backfill column phases ─────────────────────
  const phaseMap: Record<string, string> = {
    'todo': 'NOT_STARTED',
    'to-do': 'NOT_STARTED',
    'backlog': 'NOT_STARTED',
    'in-progress': 'IN_PROGRESS',
    'revisions': 'IN_PROGRESS',
    'review': 'IN_PROGRESS',
    'completed': 'DONE',
    'done': 'DONE',
    'live': 'DONE',
    'on-hold': 'ON_HOLD',
  };

  for (const [key, phase] of Object.entries(phaseMap)) {
    await prisma.boardColumn.updateMany({
      where: { key },
      data: { phase: phase as any },
    });
  }
  console.log('Backfilled column phases');

  console.log('\nDatabase seeded successfully!');
  console.log('\nLogin Credentials (all passwords: password123):');
  console.log('TL: Ali (tl.ali)');
  console.log('PMs: Rehan, Mujtaba, Anas, Aqsa');
  console.log('Production: 10 users (prod.aqsa, prod.abubakr, prod.arshanhasan, etc.)');
  console.log('Executives: Maarij Saud, Khizar Faiz, Babar Khan');
  console.log('\nBoards: Logo Design, Web Design, Web Development, Content Creation');
  console.log('Team: Xpert Web Studio (all users)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat: update seed data with real XRM team roster and single team

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Manual testing

- [ ] **Step 1: Run backend**

```bash
cd backend && npm run dev
```

Expected: Server starts on port 5000 without errors.

- [ ] **Step 2: Test Trello boards endpoint**

```bash
curl "http://localhost:5000/api/trello/boards?apiKey=c757e200e5358a6b5d6896866257b839&token=ATTA116f59e3afa76c26fb989716996797ee1360c8a3eb5745f4d03733e3451a88dc69706199" -H "Authorization: Bearer <token_for_prod.tahiranwar>"
```

Expected: Returns list of Trello boards.

- [ ] **Step 3: Test import endpoint**

```bash
curl -X POST "http://localhost:5000/api/trello/import" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token_for_prod.tahiranwar>" \
  -d '{"apiKey":"c757e200e5358a6b5d6896866257b839","token":"ATTA116f59e3afa76c26fb989716996797ee1360c8a3eb5745f4d03733e3451a88dc69706199","trelloBoardId":"68b5c57d2b03da555a9762cf"}'
```

Expected: Returns import summary with imported/skipped/failed counts.

- [ ] **Step 4: Test duplicate detection**

Run the same import command again.

Expected: All cards should show as "skipped" (0 imported).

- [ ] **Step 5: Test frontend**

```bash
cd frontend && npm run dev
```

Log in as `prod.tahiranwar` (password: `password123`). Navigate to `/dashboard/import`. Verify:
- Sidebar shows "Trello Import" link
- Can enter API key and token
- "Fetch Boards" loads the board list
- Selecting a board and clicking "Import" shows results

- [ ] **Step 6: Test authorization**

Log in as any other user. Verify:
- "Trello Import" does NOT appear in sidebar
- Navigating to `/dashboard/import` directly redirects to `/dashboard`
