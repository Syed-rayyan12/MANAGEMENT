# Production Performance & Privileges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix PRODUCTION role attribution, elevate privileges to PM/TL level (minus invoices), add auto-tracked performance metrics with a self-service dashboard.

**Architecture:** Add a `Regression` model for tracking backward column moves. Remove legacy `minorChanges`/`majorChanges` fields. Detect regressions in the existing `updateProject` controller when status moves backward. Add a new `/dashboard/my-performance` page for PRODUCTION users. Elevate PRODUCTION in route guards and frontend permissions.

**Tech Stack:** Prisma (migration + model), Express controllers, Next.js App Router page, Tailwind + shadcn/ui components.

---

## Important Context

- **PRODUCTION users don't belong to any team** in the current seed. The `createProject` controller requires team membership. We must handle this by allowing PRODUCTION users to select a team when creating a project (they see all teams already).
- **Column position** is stored in `BoardColumn.position` — lower = earlier in workflow. A move from position 2 to position 1 is a regression.
- **Due date already exists** on the `Project` model (`dueDate DateTime?`). No schema change needed for that.
- The "Record Change" UI lives in `frontend/components/project/ProjectModal.tsx` (~lines 332-360 and 534-553 and 740-755).
- Frontend permissions are in `frontend/hooks/usePermissions.ts`.
- Backend route guards are in `backend/src/routes/project.routes.ts` (line 64: `authorizeRoles('PM')` on delete).

---

### Task 1: Add Regression Model (Prisma Migration)

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add Regression model to schema**

Add after the `ProjectAssignment` model (after line 253):

```prisma
// ─── REGRESSIONS (backward column moves) ─────────

model Regression {
  id         String   @id @default(uuid())
  projectId  String
  project    Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  userId     String   // production user whose work was regressed
  user       User     @relation("regressionTarget", fields: [userId], references: [id], onDelete: Cascade)
  causedById String   // who moved it backward
  causedBy   User     @relation("regressionCauser", fields: [causedById], references: [id], onDelete: Cascade)
  fromColumn String   // column key it was in before
  toColumn   String   // column key it moved back to
  createdAt  DateTime @default(now())

  @@index([userId])
  @@index([projectId])
  @@map("regressions")
}
```

- [ ] **Step 2: Add relations to User and Project models**

In the `User` model (around line 183), add before the closing `@@map("users")`:

```prisma
  regressionsReceived Regression[] @relation("regressionTarget")
  regressionsCaused   Regression[] @relation("regressionCauser")
```

In the `Project` model (around line 225), add before `createdAt`:

```prisma
  regressions Regression[]
```

- [ ] **Step 3: Remove legacy change tracking fields from Project**

Remove these three lines from the Project model (lines 200-203):

```prisma
  // Change tracking (synced to Google Sheets)
  minorChanges      Int       @default(0)
  majorChanges      Int       @default(0)
  majorChangeReason String?
```

- [ ] **Step 4: Run migration**

```bash
cd backend && npx prisma migrate dev --name add_regressions_remove_change_tracking
```

Expected: Migration creates `regressions` table, drops `minorChanges`, `majorChanges`, `majorChangeReason` columns from `projects`.

- [ ] **Step 5: Generate Prisma client**

```bash
cd backend && npx prisma generate
```

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/
git commit -m "feat: add Regression model, remove legacy change tracking fields"
```

---

### Task 2: Regression Detection in updateProject Controller

**Files:**
- Modify: `backend/src/controllers/project.controller.ts`

- [ ] **Step 1: Add regression detection logic after the project update**

In `updateProject` (around line 370, after `const project = await prisma.project.update(...)`), add regression detection. Replace the entire changeType block (lines 361-471 — the `changeType` extraction and the Google Sheets sync fire-and-forget) with regression detection:

Remove this code (lines 361-363):
```typescript
    // Extract changeType before Prisma update — it's a transient trigger, not a DB field
    const changeType: string | undefined = updateData.changeType;
    delete updateData.changeType;
```

And remove the entire Google Sheets change tracking sync block (lines 427-471, starting with `// ── Google Sheets sync (fire-and-forget) ─────────` through `// Change tracking sync (Minor / Major)` and the async IIFE).

After the project update and activity log creation (after line 379: `await prisma.activityLog.create(...)`), add:

```typescript
    // ── Regression detection ─────────────────────────
    if (updateData.status && updateData.status !== existing.status && req.user) {
      const [oldCol, newCol] = await Promise.all([
        prisma.boardColumn.findFirst({ where: { boardId: existing.boardId, key: existing.status } }),
        prisma.boardColumn.findFirst({ where: { boardId: existing.boardId, key: updateData.status } }),
      ]);

      if (oldCol && newCol && newCol.position < oldCol.position) {
        // Backward move detected — find PRIMARY production assignees
        const productionAssignees = await prisma.projectAssignment.findMany({
          where: { projectId: id, role: 'PRIMARY', user: { role: 'PRODUCTION' } },
          select: { userId: true },
        });

        // Only create regression if the mover is NOT one of the assigned production users
        const moverId = req.user.id;
        const targetUsers = productionAssignees
          .map(a => a.userId)
          .filter(uid => uid !== moverId);

        if (targetUsers.length > 0) {
          await prisma.regression.createMany({
            data: targetUsers.map(userId => ({
              projectId: id,
              userId,
              causedById: moverId,
              fromColumn: existing.status,
              toColumn: updateData.status,
            })),
          });
        }
      }
    }
```

- [ ] **Step 2: Remove changeType from updateProject body handling**

In the `finalData` construction (around line 365-368), remove the `changeType` reference since it no longer exists. The `finalData` should just be:

```typescript
    const finalData = {
      ...updateData,
      dueDate: updateData.dueDate ? new Date(updateData.dueDate) : undefined,
    };
```

- [ ] **Step 3: Remove Google Sheets imports if no longer used elsewhere**

At the top of the file (lines 6-13), check if any other function still uses the Google Sheets utilities. If the status change sync block (lines 473+) is the only other usage, remove those imports too. Keep `emitBoardEvent` import.

Check if `findRowByCrmId`, `updateCell`, `getCellValue`, `incrementCell`, `appendProjectRow`, `getBoardRole`, `SHEET_COLUMNS` are used outside the change tracking blocks. If they're only used in the removed code and the status sync code, remove both blocks and the imports.

- [ ] **Step 4: Verify the backend compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/project.controller.ts
git commit -m "feat: add regression detection on backward column moves, remove changeType handling"
```

---

### Task 3: Elevate PRODUCTION Privileges (Backend)

**Files:**
- Modify: `backend/src/routes/project.routes.ts`
- Modify: `backend/src/controllers/project.controller.ts`

- [ ] **Step 1: Allow PRODUCTION to delete projects**

In `backend/src/routes/project.routes.ts` line 64, change:

```typescript
router.delete('/:id', authorizeRoles('PM'), deleteProject);
```

to:

```typescript
router.delete('/:id', authorizeRoles('PM', 'PRODUCTION'), deleteProject);
```

- [ ] **Step 2: Fix createProject team requirement for PRODUCTION users**

In `backend/src/controllers/project.controller.ts`, in `createProject` (around line 153-161), replace the team membership check:

```typescript
    // Determine teamId from the creator's team membership
    const creatorMemberships = await prisma.teamMember.findMany({
      where: { userId: creatorId },
      select: { teamId: true },
    });
    if (creatorMemberships.length === 0) {
      res.status(400).json({ success: false, message: 'You must belong to a team to create projects' });
      return;
    }
    const teamId = creatorMemberships[0].teamId;
```

with:

```typescript
    // Determine teamId — PRODUCTION users can specify a team, others use their membership
    let teamId: string;
    const creatorRole = req.user?.role;

    if (req.body.teamId) {
      // Explicit team selection (used by PRODUCTION users who aren't team members)
      const team = await prisma.team.findUnique({ where: { id: req.body.teamId } });
      if (!team) {
        res.status(400).json({ success: false, message: 'Specified team not found' });
        return;
      }
      teamId = team.id;
    } else {
      const creatorMemberships = await prisma.teamMember.findMany({
        where: { userId: creatorId },
        select: { teamId: true },
      });
      if (creatorMemberships.length === 0) {
        res.status(400).json({ success: false, message: 'You must belong to a team or specify a teamId to create projects' });
        return;
      }
      teamId = creatorMemberships[0].teamId;
    }
```

- [ ] **Step 3: Update createProjectSchema validator to accept optional teamId**

In `backend/src/utils/validators.ts`, find the `createProjectSchema` and add `teamId` as optional string:

```typescript
teamId: z.string().uuid().optional(),
```

- [ ] **Step 4: Verify compilation**

```bash
cd backend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/project.routes.ts backend/src/controllers/project.controller.ts backend/src/utils/validators.ts
git commit -m "feat: elevate PRODUCTION privileges — can create and delete projects"
```

---

### Task 4: New Performance Endpoint for PRODUCTION

**Files:**
- Modify: `backend/src/controllers/admin.controller.ts`

- [ ] **Step 1: Rewrite the PRODUCTION section of getEmployeePerformance**

In `backend/src/controllers/admin.controller.ts`, replace the `else if (user.role === 'PRODUCTION')` block (lines 272-290) with:

```typescript
    } else if (user.role === 'PRODUCTION') {
      // Get all assignments with project details for turnaround calculation
      const allAssignments = await prisma.projectAssignment.findMany({
        where: { userId: id },
        include: {
          project: { select: { id: true, name: true, status: true, dueDate: true, boardId: true } },
        },
      });

      const doneAssignmentsDetailed = await prisma.projectAssignment.findMany({
        where: { userId: id, status: 'DONE' },
        include: {
          project: { select: { id: true, name: true, dueDate: true, boardId: true } },
        },
      });

      // Turnaround times (days)
      const turnaroundDays: number[] = [];
      let onTimeCount = 0;
      let lateCount = 0;
      let withDueDateCount = 0;

      for (const a of doneAssignmentsDetailed) {
        if (a.completedAt && a.assignedAt) {
          const days = (a.completedAt.getTime() - a.assignedAt.getTime()) / (1000 * 60 * 60 * 24);
          turnaroundDays.push(Math.round(days * 10) / 10);
        }
        if (a.project.dueDate && a.completedAt) {
          withDueDateCount++;
          if (a.completedAt <= a.project.dueDate) {
            onTimeCount++;
          } else {
            lateCount++;
          }
        }
      }

      const avgTurnaround = turnaroundDays.length > 0
        ? Math.round(turnaroundDays.reduce((s, d) => s + d, 0) / turnaroundDays.length * 10) / 10
        : 0;
      const fastestTurnaround = turnaroundDays.length > 0 ? Math.min(...turnaroundDays) : 0;
      const slowestTurnaround = turnaroundDays.length > 0 ? Math.max(...turnaroundDays) : 0;

      // On-time rate (only projects with a due date)
      const onTimeRate = withDueDateCount > 0 ? Math.round((onTimeCount / withDueDateCount) * 100) : null;

      // Regressions
      const [totalRegressions, regressionsThisMonth] = await Promise.all([
        prisma.regression.count({ where: { userId: id } }),
        prisma.regression.count({ where: { userId: id, createdAt: { gte: startOfMonth } } }),
      ]);

      const totalAssigned = allAssignments.length;
      const regressionRate = totalAssigned > 0 ? Math.round((totalRegressions / totalAssigned) * 100) : 0;

      // Completion trend (last 6 months)
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const completionTrend = await prisma.projectAssignment.groupBy({
        by: ['completedAt'],
        where: {
          userId: id,
          status: 'DONE',
          completedAt: { gte: sixMonthsAgo },
        },
        _count: { id: true },
      });

      // Bucket completions by month
      const monthlyCompletions: { month: string; count: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

        const count = await prisma.projectAssignment.count({
          where: {
            userId: id,
            status: 'DONE',
            completedAt: { gte: monthDate, lte: monthEnd },
          },
        });
        monthlyCompletions.push({ month: monthKey, count });
      }

      // Recent completions (last 10)
      const recentCompletions = await prisma.projectAssignment.findMany({
        where: { userId: id, status: 'DONE' },
        orderBy: { completedAt: 'desc' },
        take: 10,
        include: {
          project: {
            select: { id: true, name: true, dueDate: true, board: { select: { name: true, slug: true } } },
          },
        },
      });

      const recentCompletionsList = recentCompletions.map(a => ({
        projectId: a.project.id,
        projectName: a.project.name,
        board: a.project.board.name,
        boardSlug: a.project.board.slug,
        assignedAt: a.assignedAt,
        completedAt: a.completedAt,
        turnaroundDays: a.completedAt && a.assignedAt
          ? Math.round((a.completedAt.getTime() - a.assignedAt.getTime()) / (1000 * 60 * 60 * 24) * 10) / 10
          : null,
        onTime: a.project.dueDate && a.completedAt ? a.completedAt <= a.project.dueDate : null,
      }));

      // Recent regressions (last 10)
      const recentRegressions = await prisma.regression.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          project: { select: { id: true, name: true } },
          causedBy: { select: { id: true, name: true } },
        },
      });

      const regressionsList = recentRegressions.map(r => ({
        projectId: r.project.id,
        projectName: r.project.name,
        causedBy: r.causedBy.name,
        fromColumn: r.fromColumn,
        toColumn: r.toColumn,
        createdAt: r.createdAt,
      }));

      performance = {
        ...performance,
        specialization: user.specialization,
        // Turnaround
        avgTurnaround,
        fastestTurnaround,
        slowestTurnaround,
        // On-time delivery
        onTimeRate,
        onTimeCount,
        lateCount,
        withDueDateCount,
        // Regressions
        totalRegressions,
        regressionsThisMonth,
        regressionRate,
        // Trend
        completionTrend: monthlyCompletions,
        // Lists
        recentCompletions: recentCompletionsList,
        recentRegressions: regressionsList,
      };
    }
```

- [ ] **Step 2: Verify compilation**

```bash
cd backend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/admin.controller.ts
git commit -m "feat: new PRODUCTION performance metrics — turnaround, on-time rate, regressions"
```

---

### Task 5: Self-Service Performance Endpoint

**Files:**
- Create: `backend/src/controllers/performance.controller.ts`
- Create: `backend/src/routes/performance.routes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create performance controller**

Create `backend/src/controllers/performance.controller.ts`:

```typescript
import { Request, Response } from 'express';
import prisma from '../lib/prisma';

/**
 * GET /api/performance/me
 * Returns the logged-in PRODUCTION user's own performance metrics.
 * Mirrors the admin endpoint but scoped to req.user.
 */
export const getMyPerformance = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, specialization: true, avatar: true },
    });

    if (!user || user.role !== 'PRODUCTION') {
      res.status(403).json({ success: false, message: 'This endpoint is for PRODUCTION users only' });
      return;
    }

    // Assignment counts
    const [activeAssignments, doneAssignments, primaryCount, collaboratorCount] = await Promise.all([
      prisma.projectAssignment.count({ where: { userId, status: 'ACTIVE' } }),
      prisma.projectAssignment.count({ where: { userId, status: 'DONE' } }),
      prisma.projectAssignment.count({ where: { userId, role: 'PRIMARY' } }),
      prisma.projectAssignment.count({ where: { userId, role: 'COLLABORATOR' } }),
    ]);

    // Board breakdown
    const assignmentsByBoard = await prisma.projectAssignment.findMany({
      where: { userId },
      select: { project: { select: { boardId: true } } },
    });
    const boardCounts: Record<string, number> = {};
    for (const a of assignmentsByBoard) {
      boardCounts[a.project.boardId] = (boardCounts[a.project.boardId] || 0) + 1;
    }
    const boardIds = Object.keys(boardCounts);
    const boardsInfo = await prisma.board.findMany({
      where: { id: { in: boardIds } },
      select: { id: true, name: true, slug: true },
    });
    const projectsByBoard = boardIds.map(bid => {
      const info = boardsInfo.find(b => b.id === bid);
      return { boardId: bid, boardName: info?.name || 'Unknown', boardSlug: info?.slug || '', count: boardCounts[bid] };
    });

    // Turnaround calculations
    const doneAssignmentsDetailed = await prisma.projectAssignment.findMany({
      where: { userId, status: 'DONE' },
      include: {
        project: { select: { id: true, name: true, dueDate: true, board: { select: { name: true, slug: true } } } },
      },
    });

    const turnaroundDays: number[] = [];
    let onTimeCount = 0;
    let lateCount = 0;
    let withDueDateCount = 0;

    for (const a of doneAssignmentsDetailed) {
      if (a.completedAt && a.assignedAt) {
        const days = (a.completedAt.getTime() - a.assignedAt.getTime()) / (1000 * 60 * 60 * 24);
        turnaroundDays.push(Math.round(days * 10) / 10);
      }
      if (a.project.dueDate && a.completedAt) {
        withDueDateCount++;
        if (a.completedAt <= a.project.dueDate) {
          onTimeCount++;
        } else {
          lateCount++;
        }
      }
    }

    const avgTurnaround = turnaroundDays.length > 0
      ? Math.round(turnaroundDays.reduce((s, d) => s + d, 0) / turnaroundDays.length * 10) / 10
      : 0;
    const fastestTurnaround = turnaroundDays.length > 0 ? Math.min(...turnaroundDays) : 0;
    const slowestTurnaround = turnaroundDays.length > 0 ? Math.max(...turnaroundDays) : 0;
    const onTimeRate = withDueDateCount > 0 ? Math.round((onTimeCount / withDueDateCount) * 100) : null;

    // Regressions
    const [totalRegressions, regressionsThisMonth] = await Promise.all([
      prisma.regression.count({ where: { userId } }),
      prisma.regression.count({ where: { userId, createdAt: { gte: startOfMonth } } }),
    ]);

    const totalAssigned = activeAssignments + doneAssignments;
    const regressionRate = totalAssigned > 0 ? Math.round((totalRegressions / totalAssigned) * 100) : 0;

    // Completion trend (last 6 months)
    const monthlyCompletions: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

      const count = await prisma.projectAssignment.count({
        where: { userId, status: 'DONE', completedAt: { gte: monthDate, lte: monthEnd } },
      });
      monthlyCompletions.push({ month: monthKey, count });
    }

    // Recent completions (last 10)
    const recentCompletions = await prisma.projectAssignment.findMany({
      where: { userId, status: 'DONE' },
      orderBy: { completedAt: 'desc' },
      take: 10,
      include: {
        project: { select: { id: true, name: true, dueDate: true, board: { select: { name: true, slug: true } } } },
      },
    });

    const recentCompletionsList = recentCompletions.map(a => ({
      projectId: a.project.id,
      projectName: a.project.name,
      board: a.project.board.name,
      boardSlug: a.project.board.slug,
      assignedAt: a.assignedAt,
      completedAt: a.completedAt,
      turnaroundDays: a.completedAt && a.assignedAt
        ? Math.round((a.completedAt.getTime() - a.assignedAt.getTime()) / (1000 * 60 * 60 * 24) * 10) / 10
        : null,
      onTime: a.project.dueDate && a.completedAt ? a.completedAt <= a.project.dueDate : null,
    }));

    // Recent regressions (last 10)
    const recentRegressions = await prisma.regression.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        project: { select: { id: true, name: true } },
        causedBy: { select: { id: true, name: true } },
      },
    });

    const regressionsList = recentRegressions.map(r => ({
      projectId: r.project.id,
      projectName: r.project.name,
      causedBy: r.causedBy.name,
      fromColumn: r.fromColumn,
      toColumn: r.toColumn,
      createdAt: r.createdAt,
    }));

    res.status(200).json({
      success: true,
      message: 'Performance data retrieved',
      data: {
        performance: {
          user,
          activeProjects: activeAssignments,
          completedProjects: doneAssignments,
          asPrimary: primaryCount,
          asCollaborator: collaboratorCount,
          projectsByBoard,
          avgTurnaround,
          fastestTurnaround,
          slowestTurnaround,
          onTimeRate,
          onTimeCount,
          lateCount,
          withDueDateCount,
          totalRegressions,
          regressionsThisMonth,
          regressionRate,
          completionTrend: monthlyCompletions,
          recentCompletions: recentCompletionsList,
          recentRegressions: regressionsList,
        },
      },
    });
  } catch (error) {
    console.error('Get my performance error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
```

- [ ] **Step 2: Create performance routes**

Create `backend/src/routes/performance.routes.ts`:

```typescript
import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { getMyPerformance } from '../controllers/performance.controller';

const router = Router();

router.use(authenticate);

// GET /api/performance/me — PRODUCTION user's own performance
router.get('/me', getMyPerformance);

export default router;
```

- [ ] **Step 3: Register route in app.ts**

In `backend/src/app.ts`, add the import and route registration alongside other routes:

```typescript
import performanceRoutes from './routes/performance.routes';
```

And register it:

```typescript
app.use('/api/performance', performanceRoutes);
```

- [ ] **Step 4: Verify compilation**

```bash
cd backend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/performance.controller.ts backend/src/routes/performance.routes.ts backend/src/app.ts
git commit -m "feat: add /api/performance/me endpoint for PRODUCTION self-service"
```

---

### Task 6: Update Frontend Permissions

**Files:**
- Modify: `frontend/hooks/usePermissions.ts`

- [ ] **Step 1: Update permissions for PRODUCTION elevation**

Replace the entire file content:

```typescript
import { useApp } from '@/contexts/useApp';

/**
 * Role-based permission helpers.
 *
 * Permissions:
 *   - canCreateProject: PM, TL, PRODUCTION
 *   - canDeleteProject: PM, PRODUCTION
 *   - canAddColumn: PM, TL, PRODUCTION
 *   - canChangePriority: PM, TL, PRODUCTION, EXECUTIVE
 *   - canEditProject: PM, TL, PRODUCTION
 *   - canComment: everyone
 *   - isReadOnly: EXECUTIVE (view-only)
 */
export function usePermissions() {
  const { state } = useApp();
  const role = state.currentUser?.role;
  const userId = state.currentUser?.id;

  const isPM = role === 'PM';
  const isTL = role === 'TL';
  const isExec = role === 'EXECUTIVE';
  const isProd = role === 'PRODUCTION';

  return {
    // Project CRUD
    canCreateProject: true,
    canDeleteProject: isPM || isProd,

    // Board management
    canAddColumn: true,

    // Project fields
    canChangePriority: isPM || isTL || isExec || isProd,
    canChangeStatus: isPM || isTL || isProd,
    canEditProjectFields: isPM || isTL || isProd,

    // Interaction
    canComment: true,
    canUploadAttachment: isPM || isTL || isProd,
    canManageChecklist: isPM || isTL || isProd,

    // Invoices
    canAccessInvoices: isPM || isTL || isExec,
    canCreateInvoice: isPM || isTL || isExec,

    // Drag and drop
    canDragCards: isPM || isTL || isProd,

    // Trash / soft-delete
    canSoftDelete: isPM || isProd,

    // Performance
    canAccessPerformance: isProd,

    // General
    isReadOnly: isExec,
    canAccessAdmin: isExec,

    // Helpers
    role,
    userId,
    isPM,
    isTL,
    isExec,
    isProd,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/hooks/usePermissions.ts
git commit -m "feat: elevate PRODUCTION permissions — canEditProjectFields, canDeleteProject"
```

---

### Task 7: Remove "Record Change" UI from ProjectModal

**Files:**
- Modify: `frontend/components/project/ProjectModal.tsx`
- Modify: `frontend/lib/types.ts`

- [ ] **Step 1: Remove handleChangeType function**

In `frontend/components/project/ProjectModal.tsx`, remove the `handleChangeType` function (around lines 332-360) and the `submittingChange` state variable that supports it.

- [ ] **Step 2: Remove the "Record Change" UI sections**

Remove both instances of the "Record Change" section in the JSX:
- First instance: around lines 534-553 (the `{/* Record Change */}` block)
- Second instance: around lines 740-755 (the mobile duplicate)

- [ ] **Step 3: Remove minorChanges/majorChanges from types**

In `frontend/lib/types.ts`, remove from the `Project` interface (lines 123-125):

```typescript
  minorChanges?: number;
  majorChanges?: number;
  majorChangeReason?: string;
```

And from `EmployeePerformance` interface, remove (lines 308-311):

```typescript
  totalMinorChanges?: number;
  totalMajorChanges?: number;
  averageChangesPerProject?: number;
```

And add new PRODUCTION performance fields:

```typescript
  // Production (new)
  specialization?: Specialization;
  avgTurnaround?: number;
  fastestTurnaround?: number;
  slowestTurnaround?: number;
  onTimeRate?: number | null;
  onTimeCount?: number;
  lateCount?: number;
  withDueDateCount?: number;
  totalRegressions?: number;
  regressionsThisMonth?: number;
  regressionRate?: number;
  completionTrend?: { month: string; count: number }[];
  recentCompletions?: {
    projectId: string;
    projectName: string;
    board: string;
    boardSlug: string;
    assignedAt: string;
    completedAt: string | null;
    turnaroundDays: number | null;
    onTime: boolean | null;
  }[];
  recentRegressions?: {
    projectId: string;
    projectName: string;
    causedBy: string;
    fromColumn: string;
    toColumn: string;
    createdAt: string;
  }[];
```

- [ ] **Step 4: Remove submittingChange state and any remaining references**

Search for `submittingChange` and `handleChangeType` in the file and remove all remaining references.

- [ ] **Step 5: Verify frontend compiles**

```bash
cd frontend && npx next build 2>&1 | head -30
```

Or just check for TypeScript errors:

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add frontend/components/project/ProjectModal.tsx frontend/lib/types.ts
git commit -m "feat: remove Record Change UI, update types for new performance metrics"
```

---

### Task 8: Add "My Performance" Page (Frontend)

**Files:**
- Create: `frontend/app/dashboard/my-performance/page.tsx`
- Modify: `frontend/lib/api-service.ts`
- Modify: `frontend/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add API method for performance endpoint**

In `frontend/lib/api-service.ts`, add to the exports (near the bottom, after `adminAPI`):

```typescript
export const performanceAPI = {
  getMyPerformance: async () => {
    const response = await apiFetch(`${API_BASE_URL}/performance/me`);
    return await response.json();
  },
};
```

- [ ] **Step 2: Add sidebar navigation link**

In `frontend/components/layout/Sidebar.tsx`, add a `canAccessPerformance` variable:

```typescript
const canAccessPerformance = userRole === 'PRODUCTION';
```

And add the nav item after `my-work` (around line 80):

```typescript
    ...(canAccessPerformance ? [{
      id: 'my-performance',
      label: 'My Performance',
      icon: TrendingUp,
      href: '/dashboard/my-performance',
      match: (p: string) => p === '/dashboard/my-performance',
    }] : []),
```

Add `TrendingUp` to the lucide-react import at the top of the file.

- [ ] **Step 3: Create the My Performance page**

Create `frontend/app/dashboard/my-performance/page.tsx`:

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/contexts/useApp';
import { performanceAPI } from '@/lib/api-service';
import { Loader2, TrendingUp, Clock, AlertTriangle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface PerformanceData {
  user: { id: string; name: string; role: string; specialization?: string; avatar?: string };
  activeProjects: number;
  completedProjects: number;
  asPrimary: number;
  asCollaborator: number;
  projectsByBoard: { boardId: string; boardName: string; boardSlug: string; count: number }[];
  avgTurnaround: number;
  fastestTurnaround: number;
  slowestTurnaround: number;
  onTimeRate: number | null;
  onTimeCount: number;
  lateCount: number;
  withDueDateCount: number;
  totalRegressions: number;
  regressionsThisMonth: number;
  regressionRate: number;
  completionTrend: { month: string; count: number }[];
  recentCompletions: {
    projectId: string;
    projectName: string;
    board: string;
    boardSlug: string;
    assignedAt: string;
    completedAt: string | null;
    turnaroundDays: number | null;
    onTime: boolean | null;
  }[];
  recentRegressions: {
    projectId: string;
    projectName: string;
    causedBy: string;
    fromColumn: string;
    toColumn: string;
    createdAt: string;
  }[];
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold', color || 'text-zinc-900 dark:text-zinc-100')}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

export default function MyPerformancePage() {
  const { state } = useApp();
  const router = useRouter();
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (state.currentUser?.role !== 'PRODUCTION') {
      router.push('/dashboard');
      return;
    }

    performanceAPI.getMyPerformance().then(res => {
      if (res.success) setData(res.data.performance);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [state.currentUser, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-center text-zinc-500 mt-10">Failed to load performance data.</p>;
  }

  const onTimeColor = data.onTimeRate === null ? '' : data.onTimeRate >= 80 ? 'text-green-600' : data.onTimeRate >= 50 ? 'text-yellow-600' : 'text-red-600';
  const regressionColor = data.regressionsThisMonth === 0 ? 'text-green-600' : data.regressionsThisMonth <= 2 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">My Performance</h1>
        <p className="text-sm text-zinc-500 mt-1">Your work metrics and delivery stats</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="On-Time Rate"
          value={data.onTimeRate !== null ? `${data.onTimeRate}%` : 'N/A'}
          sub={data.withDueDateCount > 0 ? `${data.onTimeCount}/${data.withDueDateCount} with deadlines` : 'No deadlines set yet'}
          color={onTimeColor}
        />
        <StatCard
          label="Avg Turnaround"
          value={`${data.avgTurnaround}d`}
          sub={data.completedProjects > 0 ? `Range: ${data.fastestTurnaround}d – ${data.slowestTurnaround}d` : undefined}
        />
        <StatCard
          label="Regressions"
          value={String(data.regressionsThisMonth)}
          sub={`This month (${data.totalRegressions} total)`}
          color={regressionColor}
        />
        <StatCard
          label="Completed"
          value={String(data.completedProjects)}
          sub={`${data.activeProjects} active`}
        />
      </div>

      {/* Completion Trend */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">Completion Trend (Last 6 Months)</h2>
        <div className="flex items-end gap-2 h-32">
          {data.completionTrend.map(m => {
            const max = Math.max(...data.completionTrend.map(x => x.count), 1);
            const height = (m.count / max) * 100;
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{m.count}</span>
                <div
                  className="w-full rounded-t bg-orange-500 dark:bg-orange-400 min-h-[4px]"
                  style={{ height: `${height}%` }}
                />
                <span className="text-[10px] text-zinc-400">
                  {new Date(m.month + '-01').toLocaleDateString('en', { month: 'short' })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two-column: Recent Completions + Regressions */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Completions */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Recent Completions</h2>
          {data.recentCompletions.length === 0 ? (
            <p className="text-xs text-zinc-400">No completions yet.</p>
          ) : (
            <div className="space-y-2">
              {data.recentCompletions.map(c => (
                <div key={c.projectId} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{c.projectName}</p>
                    <p className="text-xs text-zinc-500">{c.board}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {c.turnaroundDays !== null ? `${c.turnaroundDays}d` : '—'}
                    </p>
                    {c.onTime !== null && (
                      <span className={cn('text-xs', c.onTime ? 'text-green-600' : 'text-red-500')}>
                        {c.onTime ? 'On time' : 'Late'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Regressions */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Regressions</h2>
          {data.recentRegressions.length === 0 ? (
            <p className="text-xs text-zinc-400">No regressions. Great work!</p>
          ) : (
            <div className="space-y-2">
              {data.recentRegressions.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{r.projectName}</p>
                    <p className="text-xs text-zinc-500">
                      {r.fromColumn} → {r.toColumn} by {r.causedBy}
                    </p>
                  </div>
                  <p className="text-xs text-zinc-400">
                    {new Date(r.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Board Breakdown */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Projects by Board</h2>
        <div className="flex gap-4 flex-wrap">
          {data.projectsByBoard.map(b => (
            <div key={b.boardId} className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{b.boardName}</p>
              <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{b.count}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify frontend compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/app/dashboard/my-performance/page.tsx frontend/lib/api-service.ts frontend/components/layout/Sidebar.tsx
git commit -m "feat: add My Performance page for PRODUCTION users with full metrics dashboard"
```

---

### Task 9: Update Admin Employee View for PRODUCTION

**Files:**
- Modify: `frontend/components/admin/AdminEmployees.tsx`

- [ ] **Step 1: Update the PRODUCTION performance display**

Find the section that renders PRODUCTION performance stats (around line 628 with `liveProjects` and `completionRatio`). Replace it with new metrics display:

Find this code:
```tsx
<PerfStat label="Live Projects" value={String(performance.liveProjects || 0)} />
```
and the nearby `completionRatio` line, and replace the PRODUCTION-specific section with:

```tsx
{performance.role === 'PRODUCTION' && (
  <>
    <PerfStat label="On-Time Rate" value={performance.onTimeRate !== null && performance.onTimeRate !== undefined ? `${performance.onTimeRate}%` : 'N/A'} />
    <PerfStat label="Avg Turnaround" value={`${performance.avgTurnaround || 0}d`} />
    <PerfStat label="Regressions (Month)" value={String(performance.regressionsThisMonth || 0)} />
    <PerfStat label="Regression Rate" value={`${performance.regressionRate || 0}%`} />
    <PerfStat label="Completed" value={String(performance.completedProjects || 0)} />
    <PerfStat label="Active" value={String(performance.activeProjects || 0)} />
  </>
)}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/admin/AdminEmployees.tsx
git commit -m "feat: update admin employee view with new PRODUCTION performance metrics"
```

---

### Task 10: Update Seed Data (Remove change tracking from seeds)

**Files:**
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Remove minorChanges/majorChanges from seed project definitions**

In `backend/prisma/seed.ts`, remove `minorChanges` and `majorChanges` from all project definition objects (lines 195-247). Remove these properties from each object in the array.

Also remove lines 265-266 where they're used in the create call:
```typescript
          minorChanges: proj.minorChanges,
          majorChanges: proj.majorChanges,
```

- [ ] **Step 2: Verify seed still runs**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "chore: remove legacy change tracking from seed data"
```

---

### Task 11: Final Verification

- [ ] **Step 1: Full backend compilation check**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 2: Full frontend compilation check**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Search for any remaining references to minorChanges/majorChanges/changeType**

```bash
grep -r "minorChanges\|majorChanges\|majorChangeReason\|changeType" backend/src/ frontend/ --include="*.ts" --include="*.tsx" -l
```

Any files found need their references removed.

- [ ] **Step 4: Verify Google Sheets imports are cleaned up**

If `backend/src/controllers/project.controller.ts` still imports from `../utils/googleSheets` but no longer uses those functions, remove the unused imports.

- [ ] **Step 5: Final commit if any cleanup was needed**

```bash
git add -A && git commit -m "chore: final cleanup — remove stale references"
```
