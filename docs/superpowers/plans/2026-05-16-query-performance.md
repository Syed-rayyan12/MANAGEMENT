# Query Performance Optimization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix N+1 query patterns, reduce over-fetching on list endpoints, and add on-demand detail loading for project modals — eliminating the biggest database bottlenecks without adding infrastructure.

**Architecture:** Create a lightweight `projectCardIncludes` for list endpoints (`getAllProjects`, `getBoardProjects`) that drops full comment content, attachment data, and activity logs. Keep `getProjectById` with full includes. Frontend `ProjectModal` fetches full details on open. Fix N+1 loops in dashboard and notifications with batch queries. Deduplicate assignment fetches in `updateProject`.

**Tech Stack:** Prisma (query optimization), Express controllers, Next.js frontend (AppContext state merge)

---

### Task 1: Create lightweight projectCardIncludes for list endpoints

**Files:**
- Modify: `backend/src/controllers/project.controller.ts`

The current `projectIncludes` loads every comment (with user), every attachment, and 20 activity logs per project. For 200 projects, that's potentially 1MB+ of JSON on the initial load. The Kanban Card only needs `.length` for comments and attachments, and doesn't use activities at all.

- [ ] **Step 1: Add projectCardIncludes constant**

In `backend/src/controllers/project.controller.ts`, after the existing `projectIncludes` constant (line 16-38), add:

```typescript
// Lightweight include for list endpoints (Kanban cards, board views).
// Drops comment content, attachment data, and activity logs entirely.
// Comments/attachments return only { id } so frontend can use .length for counts.
const projectCardIncludes = {
  assignments: {
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true, role: true, specialization: true } },
    },
    orderBy: { assignedAt: 'asc' as const },
  },
  comments: { select: { id: true } },
  checklist: { orderBy: { position: 'asc' as const } },
  labels: { include: { label: true } },
  attachments: { select: { id: true } },
  board: { select: { id: true, name: true, slug: true } },
  team: { select: { id: true, name: true, slug: true } },
  client: { select: { id: true, name: true, contactEmail: true } },
};
```

- [ ] **Step 2: Update getAllProjects to use projectCardIncludes**

Change `getAllProjects` (line 93) from `include: projectIncludes` to `include: projectCardIncludes`:

```typescript
export const getAllProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const where = buildWhereClause(req.user);
    const projects = await prisma.project.findMany({
      where,
      include: projectCardIncludes,
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    });

    res.status(200).json({
      success: true,
      message: 'All projects retrieved successfully',
      data: { projects },
    });
  } catch (error) {
    console.error('Get all projects error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
```

- [ ] **Step 3: Update getBoardProjects to use projectCardIncludes**

Change `getBoardProjects` (line 71) from `include: projectIncludes` to `include: projectCardIncludes`:

```typescript
    const projects = await prisma.project.findMany({
      where,
      include: projectCardIncludes,
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    });
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/project.controller.ts
git commit -m "perf: use lightweight includes for project list endpoints"
```

---

### Task 2: Add fetch-on-open for ProjectModal

**Files:**
- Modify: `frontend/components/project/ProjectModal.tsx`
- Modify: `frontend/contexts/AppContext.tsx`

Since list endpoints no longer return full comment content, attachment URLs, or activity logs, the ProjectModal must fetch full details when opened.

- [ ] **Step 1: Add MERGE_PROJECT_DETAILS action to AppContext reducer**

In `frontend/contexts/AppContext.tsx`, add a new action type to the `AppAction` union (after the `UPDATE_PROJECT` line, around line 13):

```typescript
  | { type: 'MERGE_PROJECT_DETAILS'; payload: Project }
```

Then in the `appReducer` function, add a new case. Find the `case 'UPDATE_PROJECT':` block and add this case right after it:

```typescript
    case 'MERGE_PROJECT_DETAILS': {
      const detailed = action.payload;
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === detailed.id ? { ...p, ...detailed } : p
        ),
      };
    }
```

- [ ] **Step 2: Add useEffect to ProjectModal for fetching full details**

In `frontend/components/project/ProjectModal.tsx`, add `useEffect` to the React import (line 6):

```typescript
import React, { useState, useEffect } from 'react';
```

Then add an import for `projectAPI` if not already imported. Check line 3 — it already imports `projectAPI` from `@/lib/api-service`. Good.

After the line `if (!project) return null;` (line 49), add this useEffect **before** the existing useState hooks. Move it above the `useState` declarations to avoid the React hooks ordering issue — actually, since the early return `if (!project) return null` is before hooks, that's already a violation. The existing code has this pattern, so we'll match it. Add the useEffect after the existing useState blocks (after line 61):

```typescript
  // Fetch full project details (comments, attachments, activities) on modal open
  useEffect(() => {
    let cancelled = false;
    const fetchDetails = async () => {
      try {
        const result = await projectAPI.getById(project.id);
        if (!cancelled && result.success) {
          const p = result.data.project;
          dispatch({
            type: 'MERGE_PROJECT_DETAILS',
            payload: {
              ...project,
              comments: (p.comments || []).map((c: any) => ({
                id: c.id,
                userId: c.userId,
                content: c.content,
                timestamp: new Date(c.createdAt || c.timestamp),
              })),
              attachments: (p.attachments || []).map((a: any) => ({
                id: a.id,
                filename: a.filename,
                type: a.type,
                url: a.url,
                uploadedAt: new Date(a.uploadedAt),
              })),
              activityLog: (p.activities || p.activityLog || []).map((al: any) => ({
                id: al.id,
                userId: al.userId,
                action: al.action,
                timestamp: new Date(al.createdAt || al.timestamp),
                details: al.details,
              })),
            },
          });
        }
      } catch (error) {
        console.error('Error fetching project details:', error);
      }
    };
    fetchDetails();
    return () => { cancelled = true; };
  }, [project.id]);
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/project/ProjectModal.tsx frontend/contexts/AppContext.tsx
git commit -m "feat: fetch full project details on modal open"
```

---

### Task 3: Fix Dashboard N+1 loop

**Files:**
- Modify: `backend/src/controllers/dashboard.controller.ts`

The `getDashboardOverview` function loops through each board and makes a separate `count()` query per board. Replace with a single `groupBy`.

- [ ] **Step 1: Replace the N+1 board stats loop with groupBy**

In `backend/src/controllers/dashboard.controller.ts`, replace the board stats section (lines 30-36):

Current code:
```typescript
    const boardStats: Record<string, { name: string; slug: string; count: number }> = {};
    for (const board of boards) {
      const count = await prisma.project.count({
        where: { ...where, boardId: board.id },
      });
      boardStats[board.slug] = { name: board.name, slug: board.slug, count };
    }
```

Replace with:
```typescript
    // Single groupBy instead of N+1 count loop
    const projectCountsByBoard = await prisma.project.groupBy({
      by: ['boardId'],
      where,
      _count: { id: true },
    });
    const countMap = new Map(projectCountsByBoard.map(g => [g.boardId, g._count.id]));

    const boardStats: Record<string, { name: string; slug: string; count: number }> = {};
    for (const board of boards) {
      boardStats[board.slug] = { name: board.name, slug: board.slug, count: countMap.get(board.id) || 0 };
    }
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/controllers/dashboard.controller.ts
git commit -m "perf: replace dashboard N+1 board count loop with groupBy"
```

---

### Task 4: Fix Notification N+1 loop

**Files:**
- Modify: `backend/src/controllers/notification.controller.ts`

The `getMyNotifications` function loops through each due-soon project and makes a separate `findFirst` to check if a notification was already sent today. Replace with a batch query.

- [ ] **Step 1: Replace per-project notification check with batch query**

In `backend/src/controllers/notification.controller.ts`, replace the loop section (lines 58-83):

Current code:
```typescript
    for (const p of dueSoonProjects) {
      if (!p.dueDate) continue;
      const isOverdue = p.dueDate < now;
      const type = 'due_date';
      // Check if we already sent a due_date notification for this project today
      const existing = await prisma.notification.findFirst({
        where: {
          userId: req.user.id,
          projectId: p.id,
          type,
          createdAt: { gte: oneDayAgo },
        },
      });
      if (!existing) {
        await prisma.notification.create({
          data: {
            type,
            message: isOverdue
              ? `⏰ ${p.name} is overdue (was due ${p.dueDate.toLocaleDateString()})`
              : `⏳ ${p.name} is due soon — ${p.dueDate.toLocaleDateString()}`,
            userId: req.user.id,
            projectId: p.id,
          },
        });
      }
    }
```

Replace with:
```typescript
    if (dueSoonProjects.length > 0) {
      // Batch check: which projects already have a due_date notification today?
      const dueSoonIds = dueSoonProjects.map(p => p.id);
      const existingNotifs = await prisma.notification.findMany({
        where: {
          userId: req.user.id,
          projectId: { in: dueSoonIds },
          type: 'due_date',
          createdAt: { gte: oneDayAgo },
        },
        select: { projectId: true },
      });
      const alreadyNotified = new Set(existingNotifs.map(n => n.projectId));

      // Build notifications for projects that don't have one yet
      const newNotifs = dueSoonProjects
        .filter(p => p.dueDate && !alreadyNotified.has(p.id))
        .map(p => {
          const isOverdue = p.dueDate! < now;
          return {
            type: 'due_date',
            message: isOverdue
              ? `⏰ ${p.name} is overdue (was due ${p.dueDate!.toLocaleDateString()})`
              : `⏳ ${p.name} is due soon — ${p.dueDate!.toLocaleDateString()}`,
            userId: req.user!.id,
            projectId: p.id,
          };
        });

      if (newNotifs.length > 0) {
        await prisma.notification.createMany({ data: newNotifs });
      }
    }
```

This replaces N+1 queries (one `findFirst` + one `create` per project) with exactly 2 queries: one `findMany` + one `createMany`.

- [ ] **Step 2: Commit**

```bash
git add backend/src/controllers/notification.controller.ts
git commit -m "perf: batch notification due-date checks instead of N+1 loop"
```

---

### Task 5: Optimize addComment user fetch and updateProject assignment dedup

**Files:**
- Modify: `backend/src/controllers/project.controller.ts`

Two fixes in one task:

**Fix A:** `addComment` fetches ALL users from the database every time a comment is posted, even when there are no @mentions. Guard it.

**Fix B:** `updateProject` fetches project assignments twice — once for status change notifications and once for priority change notifications. Fetch once and reuse.

- [ ] **Step 1: Guard the all-users fetch in addComment**

In `backend/src/controllers/project.controller.ts`, find the `addComment` function. Locate the @mentions section (around line 535-544):

Current code:
```typescript
    // Parse @mentions
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const mentions = content.match(mentionRegex);
    if (mentions) {
      const allUsers = await prisma.user.findMany({ select: { id: true, name: true } });
      for (const match of mentions) {
        const username = match.substring(1).toLowerCase();
        const mentioned = allUsers.find(u => u.name.toLowerCase().replace(/\s+/g, '') === username);
        if (mentioned && mentioned.id !== req.user!.id) recipientIds.add(mentioned.id);
      }
    }
```

This is already guarded by `if (mentions)` — the query only runs when mentions are present. This is fine as-is. No change needed.

- [ ] **Step 2: Deduplicate assignment fetch in updateProject**

In `backend/src/controllers/project.controller.ts`, find the `updateProject` function. Locate the notification section (around lines 327-366).

Currently, assignments are fetched twice:
1. Line 328-331: For status change notifications
2. Line 351-354: For priority change notifications

Replace the entire notification block (lines 327-366) with a single fetch:

Find:
```typescript
      // Notify assigned members on status change
      if (updateData.status && updateData.status !== existing.status) {
        const assignedUserIds = await prisma.projectAssignment.findMany({
          where: { projectId: id },
          select: { userId: true },
        });
        const recipients = assignedUserIds
          .map(a => a.userId)
          .filter(uid => uid !== req.user!.id);

        const isCompleted = updateData.status === 'completed';
        const statusItems = recipients.map((uid) => ({
          type: isCompleted ? 'completed' : 'status',
          message: isCompleted
            ? `${actorName} marked ${existing.name} as completed! 🎉`
            : `${actorName} moved ${existing.name} to ${updateData.status}`,
          userId: uid,
          projectId: id,
          actorId: req.user!.id,
        }));
        await createManyNotifications(statusItems);
      }

      // Notify assigned members when priority escalated to CRITICAL
      if (updateData.priority && updateData.priority !== existing.priority && updateData.priority === 'CRITICAL') {
        const assignedUserIds = await prisma.projectAssignment.findMany({
          where: { projectId: id },
          select: { userId: true },
        });
        const criticalItems = assignedUserIds
          .map(a => a.userId)
          .filter(uid => uid !== req.user!.id)
          .map(uid => ({
            type: 'priority',
            message: `⚠️ ${actorName} escalated ${existing.name} to CRITICAL priority`,
            userId: uid,
            projectId: id,
            actorId: req.user!.id,
          }));
        await createManyNotifications(criticalItems);
      }
```

Replace with:
```typescript
      // Fetch assigned users once, reuse for both status and priority notifications
      const needsNotification =
        (updateData.status && updateData.status !== existing.status) ||
        (updateData.priority && updateData.priority !== existing.priority && updateData.priority === 'CRITICAL');

      if (needsNotification) {
        const assignedUserIds = await prisma.projectAssignment.findMany({
          where: { projectId: id },
          select: { userId: true },
        });
        const recipients = assignedUserIds
          .map(a => a.userId)
          .filter(uid => uid !== req.user!.id);

        // Status change notification
        if (updateData.status && updateData.status !== existing.status) {
          const isCompleted = updateData.status === 'completed';
          const statusItems = recipients.map((uid) => ({
            type: isCompleted ? 'completed' : 'status',
            message: isCompleted
              ? `${actorName} marked ${existing.name} as completed! 🎉`
              : `${actorName} moved ${existing.name} to ${updateData.status}`,
            userId: uid,
            projectId: id,
            actorId: req.user!.id,
          }));
          await createManyNotifications(statusItems);
        }

        // Priority escalation notification
        if (updateData.priority && updateData.priority !== existing.priority && updateData.priority === 'CRITICAL') {
          const criticalItems = recipients.map(uid => ({
            type: 'priority',
            message: `⚠️ ${actorName} escalated ${existing.name} to CRITICAL priority`,
            userId: uid,
            projectId: id,
            actorId: req.user!.id,
          }));
          await createManyNotifications(criticalItems);
        }
      }
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/project.controller.ts
git commit -m "perf: deduplicate assignment fetch in updateProject notifications"
```

---

### Task 6: Build and verify

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

Expected: Clean build, no errors.

- [ ] **Step 3: Fix any build errors**

If there are TypeScript or build errors, fix them and re-run the build.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build errors for query performance optimization"
```
