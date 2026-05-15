# Soft-Delete, Restore & Password-Verified Deletion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add soft-delete with 30-day retention, cascade behavior, password-verified two-step deletion, and a Trash page for restoring deleted boards/columns/projects.

**Architecture:** Add `deletedAt`/`deletedById` fields to Board, BoardColumn, and Project. All existing queries get `deletedAt: null` filters. New backend endpoints handle soft-delete (with cascade), restore, and password verification. Frontend gets delete buttons in workspace, a two-step confirmation flow, and a centralized Trash page.

**Tech Stack:** Prisma (schema + migration), Express controllers/routes, Next.js frontend, Tailwind CSS, shadcn/ui Dialog

---

### Task 1: Add soft-delete fields to Prisma schema and migrate

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add deletedAt and deletedById fields to Board model**

In `backend/prisma/schema.prisma`, update the Board model (lines 124-136) to:

```prisma
model Board {
  id             String        @id @default(uuid())
  name           String
  slug           String        @unique
  organizationId String
  organization   Organization  @relation(fields: [organizationId], references: [id])
  columns        BoardColumn[]
  projects       Project[]
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  deletedAt      DateTime?     @map("deleted_at")
  deletedById    String?       @map("deleted_by_id")
  deletedBy      User?         @relation("deletedBoards", fields: [deletedById], references: [id], onDelete: SetNull)

  @@map("boards")
}
```

- [ ] **Step 2: Add deletedAt and deletedById fields to BoardColumn model**

Update the BoardColumn model (lines 140-152) to:

```prisma
model BoardColumn {
  id          String      @id @default(uuid())
  name        String
  key         String
  color       String      @default("#6B7280")
  position    Int         @default(0)
  phase       ColumnPhase @default(NOT_STARTED)
  boardId     String
  board       Board       @relation(fields: [boardId], references: [id], onDelete: Cascade)
  deletedAt   DateTime?   @map("deleted_at")
  deletedById String?     @map("deleted_by_id")
  deletedBy   User?       @relation("deletedColumns", fields: [deletedById], references: [id], onDelete: SetNull)

  @@unique([boardId, key])
  @@map("board_columns")
}
```

- [ ] **Step 3: Add deletedAt and deletedById fields to Project model**

Update the Project model (lines 181-222). Add these two fields after `updatedAt`:

```prisma
  deletedAt      DateTime?        @map("deleted_at")
  deletedById    String?          @map("deleted_by_id")
  deletedBy      User?            @relation("deletedProjects", fields: [deletedById], references: [id], onDelete: SetNull)
```

- [ ] **Step 4: Add reverse relations to User model**

In the User model (lines 156-177), add these reverse relation fields alongside the existing relations:

```prisma
  deletedBoards   Board[]             @relation("deletedBoards")
  deletedColumns  BoardColumn[]       @relation("deletedColumns")
  deletedProjects Project[]           @relation("deletedProjects")
```

- [ ] **Step 5: Generate Prisma client and run migration**

```bash
cd backend
npx prisma generate
DATABASE_URL="postgresql://postgres:PJEGMQUYGIBPANktROhvDhjrGrzmosnP@metro.proxy.rlwy.net:26362/railway" npx prisma migrate dev --name add-soft-delete-fields
```

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add soft-delete fields to Board, BoardColumn, and Project"
```

---

### Task 2: Add deletedAt filters to all existing queries

**Files:**
- Modify: `backend/src/controllers/board.controller.ts`
- Modify: `backend/src/controllers/project.controller.ts`
- Modify: `backend/src/controllers/dashboard.controller.ts`

- [ ] **Step 1: Add deletedAt filter to board.controller.ts — getAllBoards**

In `backend/src/controllers/board.controller.ts`, line 10, update the `findMany` call:

```typescript
const boards = await prisma.board.findMany({
  where: { deletedAt: null },
  include: {
    columns: { where: { deletedAt: null }, orderBy: { position: 'asc' } },
    _count: { select: { projects: { where: { deletedAt: null } } } },
  },
  orderBy: { name: 'asc' },
});
```

- [ ] **Step 2: Add deletedAt filter to board.controller.ts — getBoardBySlug**

Line 33, update `findUnique`:

```typescript
const board = await prisma.board.findFirst({
  where: { slug, deletedAt: null },
  include: {
    columns: { where: { deletedAt: null }, orderBy: { position: 'asc' } },
  },
});
```

Note: Changed from `findUnique` to `findFirst` because `findUnique` only supports unique fields in `where`, and we're adding `deletedAt: null`.

- [ ] **Step 3: Add deletedAt filter to board.controller.ts — getBoardColumns**

Line 60, update `findMany`:

```typescript
const columns = await prisma.boardColumn.findMany({
  where: { boardId, deletedAt: null },
  orderBy: { position: 'asc' },
});
```

- [ ] **Step 4: Add deletedAt filter to board.controller.ts — createBoard slug check**

Line 88, update the slug uniqueness check to only consider active boards:

```typescript
const existing = await prisma.board.findFirst({ where: { slug, deletedAt: null } });
```

- [ ] **Step 5: Add deletedAt filter to board.controller.ts — addBoardColumn board check**

Line 165, update:

```typescript
const board = await prisma.board.findFirst({ where: { id: boardId, deletedAt: null } });
```

- [ ] **Step 6: Add deletedAt filter to board.controller.ts — addBoardColumn duplicate check**

Line 174, update:

```typescript
const existing = await prisma.boardColumn.findFirst({
  where: { boardId, key, deletedAt: null },
});
```

- [ ] **Step 7: Add deletedAt filter to board.controller.ts — addBoardColumn maxPos**

Line 183, update:

```typescript
const maxPos = await prisma.boardColumn.aggregate({
  _max: { position: true },
  where: { boardId, deletedAt: null },
});
```

- [ ] **Step 8: Add deletedAt filter to board.controller.ts — getAllBoardColumns**

Line 133, update:

```typescript
const columns = await prisma.boardColumn.findMany({
  where: { deletedAt: null },
  orderBy: { position: 'asc' },
  select: { key: true, phase: true, boardId: true },
});
```

- [ ] **Step 9: Add deletedAt filter to project.controller.ts — buildWhereClause**

In `backend/src/controllers/project.controller.ts`, update the `buildWhereClause` function (line 44-47):

```typescript
function buildWhereClause(user: Request['user']): Record<string, unknown> {
  if (!user) return { id: 'none' };
  return { deletedAt: null };
}
```

This automatically filters out soft-deleted projects from `getBoardProjects`, `getAllProjects`, and all dashboard queries that use `buildWhereClause`.

- [ ] **Step 10: Add deletedAt filter to project.controller.ts — getBoardProjects board check**

Line 61, update:

```typescript
const board = await prisma.board.findFirst({ where: { id: boardId, deletedAt: null } });
```

- [ ] **Step 11: Add deletedAt filter to project.controller.ts — getProjectById**

Line 242, update:

```typescript
const project = await prisma.project.findFirst({
  where: { id: req.params.id, deletedAt: null },
  include: projectIncludes,
});
```

- [ ] **Step 12: Add deletedAt filter to project.controller.ts — updateProject**

In the `updateProject` function, find the existing project lookup (around line 266) and update:

```typescript
const existing = await prisma.project.findFirst({ where: { id, deletedAt: null } });
```

- [ ] **Step 13: Add deletedAt filter to dashboard.controller.ts — getDashboardOverview**

In `backend/src/controllers/dashboard.controller.ts`:

Line 22, update board query:

```typescript
const boards = await prisma.board.findMany({
  where: { deletedAt: null },
  include: {
    columns: { where: { deletedAt: null }, orderBy: { position: 'asc' } },
  },
});
```

Line 59, update recentProjects query — add `where`:

```typescript
const recentProjects = await prisma.project.findMany({
  where: { deletedAt: null },
  orderBy: { createdAt: 'desc' },
  take: 5,
  include: {
    assignments: {
      include: { user: { select: { id: true, name: true, avatar: true } } },
      take: 3,
    },
    board: { select: { name: true, slug: true } },
  },
});
```

- [ ] **Step 14: Add deletedAt filter to dashboard.controller.ts — getMyDashboardStats**

Line 121, update boards query:

```typescript
const boardsInfo = await prisma.board.findMany({
  where: { id: { in: boardIds }, deletedAt: null },
  select: { id: true, name: true, slug: true },
});
```

Line 135, update recentProjects query:

```typescript
const myRecentProjects = await prisma.project.findMany({
  where: { id: { in: myProjectIds }, deletedAt: null },
  orderBy: { createdAt: 'desc' },
  take: 5,
  include: {
    assignments: {
      include: { user: { select: { id: true, name: true, avatar: true } } },
    },
    board: { select: { name: true, slug: true } },
  },
});
```

- [ ] **Step 15: Commit**

```bash
git add backend/src/controllers/board.controller.ts backend/src/controllers/project.controller.ts backend/src/controllers/dashboard.controller.ts
git commit -m "feat: add deletedAt null filters to all existing queries"
```

---

### Task 3: Add verify-password endpoint

**Files:**
- Modify: `backend/src/controllers/auth.controller.ts`
- Modify: `backend/src/routes/auth.routes.ts`

- [ ] **Step 1: Add verifyPassword controller**

In `backend/src/controllers/auth.controller.ts`, add this function at the end of the file (before any closing braces if applicable):

```typescript
/**
 * Verify the current user's password
 * POST /api/auth/verify-password
 */
export const verifyPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { password } = req.body;

    if (!password) {
      res.status(400).json({ success: false, message: 'Password is required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.status(401).json({ success: false, message: 'Invalid password' });
      return;
    }

    res.status(200).json({ success: true, message: 'Password verified' });
  } catch (error) {
    console.error('Verify password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
```

Make sure `prisma` is imported at the top of the file. Check if it already is — if not, add:

```typescript
import prisma from '../lib/prisma';
```

- [ ] **Step 2: Add the route**

Read `backend/src/routes/auth.routes.ts` first, then add the route. Import `verifyPassword` from the controller and add:

```typescript
import { authenticate } from '../middlewares/auth.middleware';

// Add after existing routes
router.post('/verify-password', authenticate, verifyPassword);
```

- [ ] **Step 3: Add frontend API method**

In `frontend/lib/api-service.ts`, find the `authAPI` object (or create one if it doesn't exist). Add:

```typescript
export const authAPI = {
  verifyPassword: async (password: string) => {
    const response = await apiFetch(`${API_BASE_URL}/auth/verify-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    return await response.json();
  },
};
```

If there's no `authAPI` object, add this after the last API object export (after `boardAPI`).

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/auth.controller.ts backend/src/routes/auth.routes.ts frontend/lib/api-service.ts
git commit -m "feat: add verify-password endpoint for deletion confirmation"
```

---

### Task 4: Add soft-delete and trash backend endpoints

**Files:**
- Create: `backend/src/controllers/trash.controller.ts`
- Create: `backend/src/routes/trash.routes.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/routes/board.routes.ts`

- [ ] **Step 1: Create trash.controller.ts**

Create `backend/src/controllers/trash.controller.ts`:

```typescript
import { Request, Response } from 'express';
import prisma from '../lib/prisma';

/**
 * Soft-delete a board and cascade to its columns and projects.
 * POST /api/boards/:boardId/soft-delete
 */
export const softDeleteBoard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { boardId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const board = await prisma.board.findFirst({ where: { id: boardId, deletedAt: null } });
    if (!board) {
      res.status(404).json({ success: false, message: 'Board not found' });
      return;
    }

    const now = new Date();

    await prisma.$transaction([
      prisma.board.update({
        where: { id: boardId },
        data: { deletedAt: now, deletedById: userId },
      }),
      prisma.boardColumn.updateMany({
        where: { boardId, deletedAt: null },
        data: { deletedAt: now, deletedById: userId },
      }),
      prisma.project.updateMany({
        where: { boardId, deletedAt: null },
        data: { deletedAt: now, deletedById: userId },
      }),
    ]);

    res.status(200).json({ success: true, message: 'Board moved to trash' });
  } catch (error) {
    console.error('Soft delete board error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Soft-delete a column and cascade to its projects.
 * POST /api/boards/:boardId/columns/:columnId/soft-delete
 */
export const softDeleteColumn = async (req: Request, res: Response): Promise<void> => {
  try {
    const { boardId, columnId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const column = await prisma.boardColumn.findFirst({
      where: { id: columnId, boardId, deletedAt: null },
    });
    if (!column) {
      res.status(404).json({ success: false, message: 'Column not found' });
      return;
    }

    const now = new Date();

    await prisma.$transaction([
      prisma.boardColumn.update({
        where: { id: columnId },
        data: { deletedAt: now, deletedById: userId },
      }),
      prisma.project.updateMany({
        where: { boardId, status: column.key, deletedAt: null },
        data: { deletedAt: now, deletedById: userId },
      }),
    ]);

    res.status(200).json({ success: true, message: 'Column moved to trash' });
  } catch (error) {
    console.error('Soft delete column error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Soft-delete a single project.
 * POST /api/projects/:id/soft-delete
 */
export const softDeleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const project = await prisma.project.findFirst({ where: { id, deletedAt: null } });
    if (!project) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }

    await prisma.project.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: userId },
    });

    // Log activity
    await prisma.activityLog.create({
      data: { action: `Moved project to trash: ${project.name}`, userId },
    });

    res.status(200).json({ success: true, message: 'Project moved to trash' });
  } catch (error) {
    console.error('Soft delete project error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * List all soft-deleted items.
 * GET /api/trash
 */
export const getTrash = async (_req: Request, res: Response): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [boards, columns, projects] = await Promise.all([
      prisma.board.findMany({
        where: { deletedAt: { not: null, gte: thirtyDaysAgo } },
        include: {
          deletedBy: { select: { id: true, name: true } },
          _count: {
            select: {
              columns: { where: { deletedAt: { not: null } } },
              projects: { where: { deletedAt: { not: null } } },
            },
          },
        },
        orderBy: { deletedAt: 'desc' },
      }),
      prisma.boardColumn.findMany({
        where: {
          deletedAt: { not: null, gte: thirtyDaysAgo },
          board: { deletedAt: null },
        },
        include: {
          board: { select: { id: true, name: true, slug: true } },
          deletedBy: { select: { id: true, name: true } },
        },
        orderBy: { deletedAt: 'desc' },
      }),
      prisma.project.findMany({
        where: {
          deletedAt: { not: null, gte: thirtyDaysAgo },
          board: { deletedAt: null },
        },
        include: {
          board: { select: { id: true, name: true, slug: true } },
          deletedBy: { select: { id: true, name: true } },
        },
        orderBy: { deletedAt: 'desc' },
      }),
    ]);

    const now = new Date();
    const addDaysRemaining = (item: any) => ({
      ...item,
      daysRemaining: Math.max(0, 30 - Math.floor((now.getTime() - new Date(item.deletedAt).getTime()) / (1000 * 60 * 60 * 24))),
    });

    res.status(200).json({
      success: true,
      data: {
        boards: boards.map(addDaysRemaining),
        columns: columns.map(addDaysRemaining),
        projects: projects.map(addDaysRemaining),
      },
    });
  } catch (error) {
    console.error('Get trash error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Restore a soft-deleted item and its cascade-deleted children.
 * POST /api/trash/restore
 * Body: { type: 'board' | 'column' | 'project', id: string }
 */
export const restoreItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, id } = req.body;

    if (!type || !id) {
      res.status(400).json({ success: false, message: 'type and id are required' });
      return;
    }

    if (type === 'board') {
      const board = await prisma.board.findFirst({ where: { id, deletedAt: { not: null } } });
      if (!board) {
        res.status(404).json({ success: false, message: 'Deleted board not found' });
        return;
      }

      // Check slug conflict with active boards
      const conflict = await prisma.board.findFirst({ where: { slug: board.slug, deletedAt: null } });
      const newSlug = conflict ? `${board.slug}-restored` : board.slug;

      // Restore board + cascade-deleted children (within 2 second window of board's deletedAt)
      const deletedAt = board.deletedAt!;
      const windowStart = new Date(deletedAt.getTime() - 1000);
      const windowEnd = new Date(deletedAt.getTime() + 1000);

      await prisma.$transaction([
        prisma.board.update({
          where: { id },
          data: { deletedAt: null, deletedById: null, slug: newSlug },
        }),
        prisma.boardColumn.updateMany({
          where: {
            boardId: id,
            deletedAt: { gte: windowStart, lte: windowEnd },
          },
          data: { deletedAt: null, deletedById: null },
        }),
        prisma.project.updateMany({
          where: {
            boardId: id,
            deletedAt: { gte: windowStart, lte: windowEnd },
          },
          data: { deletedAt: null, deletedById: null },
        }),
      ]);

      res.status(200).json({ success: true, message: 'Board restored' });
    } else if (type === 'column') {
      const column = await prisma.boardColumn.findFirst({
        where: { id, deletedAt: { not: null } },
        include: { board: { select: { deletedAt: true } } },
      });
      if (!column) {
        res.status(404).json({ success: false, message: 'Deleted column not found' });
        return;
      }
      if (column.board.deletedAt) {
        res.status(400).json({ success: false, message: 'Cannot restore column — its board is also deleted. Restore the board first.' });
        return;
      }

      const deletedAt = column.deletedAt!;
      const windowStart = new Date(deletedAt.getTime() - 1000);
      const windowEnd = new Date(deletedAt.getTime() + 1000);

      await prisma.$transaction([
        prisma.boardColumn.update({
          where: { id },
          data: { deletedAt: null, deletedById: null },
        }),
        prisma.project.updateMany({
          where: {
            boardId: column.boardId,
            status: column.key,
            deletedAt: { gte: windowStart, lte: windowEnd },
          },
          data: { deletedAt: null, deletedById: null },
        }),
      ]);

      res.status(200).json({ success: true, message: 'Column restored' });
    } else if (type === 'project') {
      const project = await prisma.project.findFirst({
        where: { id, deletedAt: { not: null } },
        include: { board: { select: { deletedAt: true } } },
      });
      if (!project) {
        res.status(404).json({ success: false, message: 'Deleted project not found' });
        return;
      }
      if (project.board.deletedAt) {
        res.status(400).json({ success: false, message: 'Cannot restore project — its board is deleted. Restore the board first.' });
        return;
      }

      await prisma.project.update({
        where: { id },
        data: { deletedAt: null, deletedById: null },
      });

      res.status(200).json({ success: true, message: 'Project restored' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid type. Must be board, column, or project.' });
    }
  } catch (error) {
    console.error('Restore item error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Purge items deleted more than 30 days ago.
 * Called on app startup.
 */
export const purgeExpiredTrash = async (): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Delete in order: projects first, then columns, then boards (respect FK constraints)
    const [deletedProjects, deletedColumns, deletedBoards] = await prisma.$transaction([
      prisma.project.deleteMany({ where: { deletedAt: { lt: thirtyDaysAgo } } }),
      prisma.boardColumn.deleteMany({ where: { deletedAt: { lt: thirtyDaysAgo } } }),
      prisma.board.deleteMany({ where: { deletedAt: { lt: thirtyDaysAgo } } }),
    ]);

    const total = deletedProjects.count + deletedColumns.count + deletedBoards.count;
    if (total > 0) {
      console.log(`Purged ${total} expired trash items (${deletedBoards.count} boards, ${deletedColumns.count} columns, ${deletedProjects.count} projects)`);
    }
  } catch (error) {
    console.error('Purge expired trash error:', error);
  }
};
```

- [ ] **Step 2: Create trash.routes.ts**

Create `backend/src/routes/trash.routes.ts`:

```typescript
import { Router } from 'express';
import { getTrash, restoreItem } from '../controllers/trash.controller';
import { softDeleteBoard, softDeleteColumn } from '../controllers/trash.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(authorizeRoles('PM', 'PRODUCTION'));

router.get('/', getTrash);
router.post('/restore', restoreItem);

export default router;
```

- [ ] **Step 3: Add soft-delete routes to board.routes.ts**

In `backend/src/routes/board.routes.ts`, add imports and routes. Update the imports:

```typescript
import { getAllBoards, getBoardBySlug, getBoardColumns, createBoard, addBoardColumn, getAllBoardColumns } from '../controllers/board.controller';
import { softDeleteBoard, softDeleteColumn } from '../controllers/trash.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';
```

Add these routes BEFORE the `/:slug` route (before `router.get('/:slug', getBoardBySlug)`):

```typescript
// Soft-delete board
router.post('/:boardId/soft-delete', authorizeRoles('PM', 'PRODUCTION'), softDeleteBoard);

// Soft-delete column
router.post('/:boardId/columns/:columnId/soft-delete', authorizeRoles('PM', 'PRODUCTION'), softDeleteColumn);
```

- [ ] **Step 4: Add soft-delete project route to project.routes.ts**

In `backend/src/routes/project.routes.ts`, add import and route. Update imports to include `softDeleteProject`:

```typescript
import { softDeleteProject } from '../controllers/trash.controller';
```

Add the route BEFORE the `/:id` GET route:

```typescript
// Soft-delete project (must be before /:id to avoid param conflict)
router.post('/:id/soft-delete', authorizeRoles('PM', 'PRODUCTION'), softDeleteProject);
```

- [ ] **Step 5: Register trash routes and auto-purge in app.ts**

In `backend/src/app.ts`, add the import at the top with other route imports:

```typescript
import trashRoutes from './routes/trash.routes';
```

Add the route registration after the existing routes (after line 95):

```typescript
app.use('/api/trash', apiLimiter, trashRoutes);
```

Also import and call the purge function. Add to imports:

```typescript
import { purgeExpiredTrash } from './controllers/trash.controller';
```

Add the purge call after the route registrations, before the 404 handler:

```typescript
// Purge expired trash on startup
purgeExpiredTrash();
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/trash.controller.ts backend/src/routes/trash.routes.ts backend/src/routes/board.routes.ts backend/src/routes/project.routes.ts backend/src/app.ts
git commit -m "feat: add soft-delete, trash listing, restore, and auto-purge endpoints"
```

---

### Task 5: Update frontend types and API service

**Files:**
- Modify: `frontend/lib/types.ts`
- Modify: `frontend/lib/api-service.ts`
- Modify: `frontend/hooks/usePermissions.ts`

- [ ] **Step 1: Add trash-related types**

In `frontend/lib/types.ts`, add at the end of the file:

```typescript
export interface TrashItem {
  id: string;
  name: string;
  deletedAt: string;
  deletedBy: { id: string; name: string } | null;
  daysRemaining: number;
}

export interface TrashBoard extends TrashItem {
  slug: string;
  _count: { columns: number; projects: number };
}

export interface TrashColumn extends TrashItem {
  key: string;
  board: { id: string; name: string; slug: string };
}

export interface TrashProject extends TrashItem {
  priority: string;
  status: string;
  board: { id: string; name: string; slug: string };
}

export interface TrashData {
  boards: TrashBoard[];
  columns: TrashColumn[];
  projects: TrashProject[];
}
```

- [ ] **Step 2: Add trash API methods**

In `frontend/lib/api-service.ts`, add after the `boardAPI` object:

```typescript
export const trashAPI = {
  getAll: async () => {
    const response = await apiFetch(`${API_BASE_URL}/trash`);
    return await response.json();
  },

  restore: async (type: 'board' | 'column' | 'project', id: string) => {
    const response = await apiFetch(`${API_BASE_URL}/trash/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id }),
    });
    return await response.json();
  },

  softDeleteBoard: async (boardId: string) => {
    const response = await apiFetch(`${API_BASE_URL}/boards/${boardId}/soft-delete`, {
      method: 'POST',
    });
    return await response.json();
  },

  softDeleteColumn: async (boardId: string, columnId: string) => {
    const response = await apiFetch(`${API_BASE_URL}/boards/${boardId}/columns/${columnId}/soft-delete`, {
      method: 'POST',
    });
    return await response.json();
  },

  softDeleteProject: async (projectId: string) => {
    const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/soft-delete`, {
      method: 'POST',
    });
    return await response.json();
  },
};
```

- [ ] **Step 3: Update usePermissions to add canSoftDelete**

In `frontend/hooks/usePermissions.ts`, add to the return object (after `canDeleteProject`):

```typescript
    canSoftDelete: isPM || isProd,
```

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/types.ts frontend/lib/api-service.ts frontend/hooks/usePermissions.ts
git commit -m "feat: add trash types, API methods, and canSoftDelete permission"
```

---

### Task 6: Create the two-step deletion confirmation component

**Files:**
- Create: `frontend/components/shared/DeleteConfirmation.tsx`

- [ ] **Step 1: Create the DeleteConfirmation component**

Create `frontend/components/shared/DeleteConfirmation.tsx`:

```tsx
'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { authAPI } from '@/lib/api-service';

interface DeleteConfirmationProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  description: string;
  impactSummary?: string;
}

export function DeleteConfirmation({ open, onClose, onConfirm, title, description, impactSummary }: DeleteConfirmationProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleClose = () => {
    setStep(1);
    setPassword('');
    setError('');
    setLoading(false);
    onClose();
  };

  const handleContinue = () => {
    setStep(2);
    setError('');
  };

  const handleDelete = async () => {
    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const verifyResult = await authAPI.verifyPassword(password);
      if (!verifyResult.success) {
        setError('Incorrect password');
        setLoading(false);
        return;
      }

      await onConfirm();
      handleClose();
    } catch (err) {
      setError('Incorrect password');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                {title}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>

              {impactSummary && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 p-3">
                  <p className="text-sm text-red-700 dark:text-red-400" dangerouslySetInnerHTML={{ __html: impactSummary }} />
                </div>
              )}

              <p className="text-xs text-zinc-400">Items can be restored from Trash within 30 days.</p>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleClose} variant="outline" className="flex-1 text-zinc-700 dark:text-zinc-300">
                  Cancel
                </Button>
                <Button onClick={handleContinue} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                  Continue
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Enter your password to confirm
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <div>
                <Label htmlFor="deletePassword" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Password
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="deletePassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
                    className="pr-10 placeholder:text-gray-400"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={() => { setStep(1); setError(''); setPassword(''); }} variant="outline" className="flex-1 text-zinc-700 dark:text-zinc-300">
                  Back
                </Button>
                <Button onClick={handleDelete} disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Delete
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/shared/DeleteConfirmation.tsx
git commit -m "feat: create two-step delete confirmation component with password verification"
```

---

### Task 7: Add delete buttons to workspace page

**Files:**
- Modify: `frontend/app/dashboard/[workspace]/page.tsx`

- [ ] **Step 1: Add imports**

In `frontend/app/dashboard/[workspace]/page.tsx`, add to the existing imports:

```typescript
import { Trash2, MoreVertical } from 'lucide-react';
import { DeleteConfirmation } from '@/components/shared/DeleteConfirmation';
import { trashAPI } from '@/lib/api-service';
```

- [ ] **Step 2: Add state for delete modals**

After the existing state declarations (around line 37-47), add:

```typescript
const [deleteTarget, setDeleteTarget] = useState<{ type: 'board' | 'column'; id: string; name: string; projectCount: number; columnCount?: number } | null>(null);
const { canSoftDelete } = usePermissions();
```

Note: `usePermissions` is already imported.

- [ ] **Step 3: Add handleSoftDelete function**

After `handleAddColumn` (around line 107), add:

```typescript
const handleSoftDelete = async () => {
  if (!deleteTarget || !boardId) return;
  try {
    if (deleteTarget.type === 'board') {
      await trashAPI.softDeleteBoard(boardId);
      router.push('/dashboard');
    } else {
      await trashAPI.softDeleteColumn(boardId, deleteTarget.id);
      // Refresh board data
      const result = await boardAPI.getBySlug(workspace as string);
      if (result.success) {
        const cols = result.data.board.columns
          .sort((a: any, b: any) => a.position - b.position)
          .map((c: any) => ({
            status: c.key,
            label: c.name,
            color: c.color,
            isCustom: false,
            phase: c.phase || 'NOT_STARTED',
          }));
        setCustomColumns(cols);
        setRefreshKey(prev => prev + 1);
      }
    }
  } catch (error) {
    console.error('Delete error:', error);
  }
};
```

- [ ] **Step 4: Add Delete Workspace button to the header**

Find the header area where the "Add Column" button is rendered (around line 185). Add a delete workspace button before the Add Column button, inside the same flex container:

```tsx
{canSoftDelete && (
  <Button
    onClick={() => {
      const projCount = customColumns.reduce((acc, _col) => acc, 0);
      setDeleteTarget({
        type: 'board',
        id: boardId || '',
        name: displayName,
        projectCount: projects.length,
        columnCount: customColumns.length,
      });
    }}
    variant="outline"
    className="border-red-500/30 hover:bg-red-500/10 text-red-500 hover:text-red-600"
  >
    <Trash2 className="w-4 h-4 mr-2" />
    Delete Workspace
  </Button>
)}
```

Note: You'll need to capture `projects` from the board data. Check if there's already a projects array in state. If not, the `_count` from the board API response can be used instead. Adjust the projectCount logic accordingly based on what data is available — check the `state.projects` from AppContext which is already loaded.

- [ ] **Step 5: Pass column delete handler to Board component**

The workspace page renders a `<Board>` component. We need to pass delete handlers to it so columns can have delete buttons. Find where `<Board>` is rendered and check what props it accepts.

Read `frontend/components/kanban/Board.tsx` to understand its interface. The column delete UI should be added to the column header in `frontend/components/kanban/Column.tsx`.

In the workspace page, pass a callback to the Board component:

```tsx
<Board
  // ...existing props
  onDeleteColumn={canSoftDelete ? (columnId: string, columnName: string, projectCount: number) => {
    setDeleteTarget({ type: 'column', id: columnId, name: columnName, projectCount });
  } : undefined}
/>
```

Then update `Board.tsx` and `Column.tsx` to accept and wire through this prop. In `Column.tsx`, add a three-dot dropdown menu in the column header with a "Delete Column" option. The dropdown should use the existing `DropdownMenu` components from shadcn/ui.

- [ ] **Step 6: Add DeleteConfirmation modal to the page**

At the end of the JSX (before the closing `</div>` of the page), add:

```tsx
{deleteTarget && (
  <DeleteConfirmation
    open={!!deleteTarget}
    onClose={() => setDeleteTarget(null)}
    onConfirm={handleSoftDelete}
    title={`Delete ${deleteTarget.type === 'board' ? 'Workspace' : 'Column'}?`}
    description={`This will delete "${deleteTarget.name}" and move it to trash.`}
    impactSummary={
      deleteTarget.type === 'board'
        ? `This will delete <strong>${deleteTarget.name}</strong> along with <strong>${deleteTarget.columnCount || 0} columns</strong> and <strong>${deleteTarget.projectCount} projects</strong>.`
        : `This will delete column <strong>${deleteTarget.name}</strong> and <strong>${deleteTarget.projectCount} projects</strong> in it.`
    }
  />
)}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/app/dashboard/[workspace]/page.tsx frontend/components/kanban/Board.tsx frontend/components/kanban/Column.tsx
git commit -m "feat: add delete workspace and delete column buttons with confirmation"
```

---

### Task 8: Create the Trash page

**Files:**
- Create: `frontend/app/dashboard/trash/page.tsx`

- [ ] **Step 1: Create the Trash page**

Create `frontend/app/dashboard/trash/page.tsx`:

```tsx
'use client';

import React, { useState, useEffect } from 'react';
import { trashAPI } from '@/lib/api-service';
import { TrashData, TrashBoard, TrashColumn, TrashProject } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Trash2, RotateCcw, Loader2, Package, Columns3, FolderKanban, Clock } from 'lucide-react';

type Tab = 'boards' | 'columns' | 'projects';

export default function TrashPage() {
  const [data, setData] = useState<TrashData>({ boards: [], columns: [], projects: [] });
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('boards');

  const fetchTrash = async () => {
    try {
      const result = await trashAPI.getAll();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Error fetching trash:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTrash(); }, []);

  const handleRestore = async (type: 'board' | 'column' | 'project', id: string) => {
    setRestoringId(id);
    try {
      const result = await trashAPI.restore(type, id);
      if (result.success) {
        await fetchTrash();
      } else {
        alert(result.message || 'Failed to restore');
      }
    } catch (error) {
      console.error('Restore error:', error);
    } finally {
      setRestoringId(null);
    }
  };

  const totalCount = data.boards.length + data.columns.length + data.projects.length;

  const tabs: { key: Tab; label: string; count: number; icon: React.ElementType }[] = [
    { key: 'boards', label: 'Boards', count: data.boards.length, icon: FolderKanban },
    { key: 'columns', label: 'Columns', count: data.columns.length, icon: Columns3 },
    { key: 'projects', label: 'Projects', count: data.projects.length, icon: Package },
  ];

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
          <Trash2 className="w-5 h-5 text-red-500" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">Trash</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">
            {totalCount === 0 ? 'Trash is empty' : `${totalCount} items — auto-deleted after 30 days`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-orange-500 text-orange-500'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key
                    ? 'bg-orange-500/15 text-orange-500'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      ) : (
        <div className="space-y-2">
          {activeTab === 'boards' && data.boards.map((board) => (
            <TrashRow
              key={board.id}
              name={board.name}
              subtitle={`${board._count.columns} columns, ${board._count.projects} projects`}
              deletedBy={board.deletedBy?.name || 'Unknown'}
              deletedAt={formatTimeAgo(board.deletedAt)}
              daysRemaining={board.daysRemaining}
              restoring={restoringId === board.id}
              onRestore={() => handleRestore('board', board.id)}
            />
          ))}

          {activeTab === 'columns' && data.columns.map((column) => (
            <TrashRow
              key={column.id}
              name={column.name}
              subtitle={`Board: ${column.board.name}`}
              deletedBy={column.deletedBy?.name || 'Unknown'}
              deletedAt={formatTimeAgo(column.deletedAt)}
              daysRemaining={column.daysRemaining}
              restoring={restoringId === column.id}
              onRestore={() => handleRestore('column', column.id)}
            />
          ))}

          {activeTab === 'projects' && data.projects.map((project) => (
            <TrashRow
              key={project.id}
              name={project.name}
              subtitle={`Board: ${project.board.name}`}
              deletedBy={project.deletedBy?.name || 'Unknown'}
              deletedAt={formatTimeAgo(project.deletedAt)}
              daysRemaining={project.daysRemaining}
              restoring={restoringId === project.id}
              onRestore={() => handleRestore('project', project.id)}
            />
          ))}

          {/* Empty state for active tab */}
          {((activeTab === 'boards' && data.boards.length === 0) ||
            (activeTab === 'columns' && data.columns.length === 0) ||
            (activeTab === 'projects' && data.projects.length === 0)) && (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
              <Trash2 className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">No deleted {activeTab}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TrashRow({
  name,
  subtitle,
  deletedBy,
  deletedAt,
  daysRemaining,
  restoring,
  onRestore,
}: {
  name: string;
  subtitle: string;
  deletedBy: string;
  deletedAt: string;
  daysRemaining: number;
  restoring: boolean;
  onRestore: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{name}</p>
        <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-6 ml-4">
        <div className="text-right hidden sm:block">
          <p className="text-xs text-zinc-500">Deleted by {deletedBy}</p>
          <p className="text-xs text-zinc-400">{deletedAt}</p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-amber-500">
          <Clock className="w-3.5 h-3.5" />
          <span>{daysRemaining}d left</span>
        </div>

        <Button
          onClick={onRestore}
          disabled={restoring}
          variant="outline"
          size="sm"
          className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
        >
          {restoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-1.5" />}
          Restore
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/dashboard/trash/page.tsx
git commit -m "feat: create Trash page with restore functionality"
```

---

### Task 9: Add Trash link to sidebar

**Files:**
- Modify: `frontend/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add Trash2 to lucide imports**

In `frontend/components/layout/Sidebar.tsx`, line 8, add `Trash2` to the lucide-react import:

```typescript
import {
  LayoutDashboard,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  User,
  FileText,
  Shield,
  Trash2,
} from 'lucide-react';
```

- [ ] **Step 2: Add Trash nav item**

In the `navItems` array (line 64-93), add the Trash item after the invoices entry and before the admin entry. It should be visible only to PM and PRODUCTION:

```typescript
const canAccessTrash = userRole === 'PM' || userRole === 'PRODUCTION';
```

Add this line after `canAccessAdmin` (line 62). Then update `navItems`:

```typescript
const navItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
    match: (p: string) => p === '/dashboard',
  },
  {
    id: 'my-work',
    label: 'My Work',
    icon: Briefcase,
    href: '/dashboard/my-work',
    match: (p: string) => p === '/dashboard/my-work',
  },
  ...(canAccessInvoices ? [{
    id: 'invoices',
    label: 'Invoices',
    icon: FileText,
    href: '/dashboard/invoices',
    match: (p: string) => p === '/dashboard/invoices',
  }] : []),
  ...(canAccessTrash ? [{
    id: 'trash',
    label: 'Trash',
    icon: Trash2,
    href: '/dashboard/trash',
    match: (p: string) => p === '/dashboard/trash',
  }] : []),
  ...(canAccessAdmin ? [{
    id: 'admin',
    label: 'Management',
    icon: Shield,
    href: '/dashboard/admin',
    match: (p: string) => p.startsWith('/dashboard/admin'),
  }] : []),
];
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/layout/Sidebar.tsx
git commit -m "feat: add Trash link to sidebar for PM and PRODUCTION roles"
```

---

### Task 10: Build and verify

**Files:** None (verification only)

- [ ] **Step 1: Build backend**

```bash
cd backend && npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 2: Build frontend**

```bash
cd frontend && npx next build
```

Expected: Clean build, no errors. The `/dashboard/trash` route should appear in the route list.

- [ ] **Step 3: Fix any build errors**

If there are TypeScript or build errors, fix them and re-run the build.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build errors for soft-delete feature"
```
