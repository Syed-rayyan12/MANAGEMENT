# Performance & KPI Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace label-based member system and single pmId/developerId fields with a ProjectAssignment table, and build role-specific performance KPIs for all employees.

**Architecture:** New `ProjectAssignment` join table (project ↔ user) with role (PRIMARY/COLLABORATOR) and status (ACTIVE/DONE). All member management flows through assignments. Performance modals query assignments + invoices for role-specific KPIs. Labels revert to pure tags.

**Tech Stack:** Prisma ORM, Express.js, TypeScript, React 19, Next.js 16, shadcn/ui, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-05-14-performance-kpi-module-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `backend/src/controllers/assignment.controller.ts` | CRUD handlers for project assignments |
| `backend/src/routes/assignment.routes.ts` | Routes for `/api/projects/:projectId/assignments` |

### Modified Files
| File | Change Summary |
|------|---------------|
| `backend/prisma/schema.prisma` | Add AssignmentRole, AssignmentStatus enums + ProjectAssignment model. Remove pmId/developerId from Project. |
| `backend/prisma/seed.ts` | Create ProjectAssignment records instead of pmId/developerId. Add sample assignments with mixed roles/statuses. |
| `backend/src/utils/validators.ts` | Add assignment schemas. Remove developerId/pmId from project schemas. |
| `backend/src/controllers/project.controller.ts` | Replace pmId/developerId with assignments in projectIncludes, createProject, updateProject. Remove addLabel/removeLabel member logic (keep for actual tags). |
| `backend/src/controllers/admin.controller.ts` | Rewrite getEmployees stats + getEmployeePerformance for new KPI structure. Update deleteEmployee. |
| `backend/src/controllers/dashboard.controller.ts` | Replace pmId/developerId refs with assignment queries. |
| `backend/src/routes/project.routes.ts` | Mount assignment routes. |
| `backend/src/app.ts` | No change needed — assignment routes are sub-routes of projects. |
| `frontend/lib/types.ts` | Add AssignmentRole, AssignmentStatus, ProjectAssignment types. Update Project interface. Update performance types. |
| `frontend/lib/api-service.ts` | Add assignmentAPI. Update performance response types. |
| `frontend/contexts/AppContext.tsx` | Update mapApiProject for assignments instead of pm/developer. |
| `frontend/components/kanban/Card.tsx` | Read members from assignments, green checkmark for DONE, use assignmentAPI. |
| `frontend/components/project/ProjectModal.tsx` | Assignments section with role/status controls. |
| `frontend/components/project/CreateProjectModal.tsx` | PM picker creates first assignment. Members added as assignments. |
| `frontend/components/admin/AdminEmployees.tsx` | Rewrite PerformanceContent for new KPI structure. |
| `frontend/components/admin/AdminOverview.tsx` | Add assignment stat cards. |
| `frontend/hooks/usePermissions.ts` | Add canToggleAssignment. |

---

## Task 1: Schema Changes — ProjectAssignment Model

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add new enums after the existing Specialization enum**

After the `Specialization` enum (around line 43), add:

```prisma
enum AssignmentRole {
  PRIMARY
  COLLABORATOR
}

enum AssignmentStatus {
  ACTIVE
  DONE
}
```

- [ ] **Step 2: Add ProjectAssignment model**

After the `Project` model, add:

```prisma
model ProjectAssignment {
  id          String           @id @default(uuid())
  projectId   String
  project     Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  userId      String
  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  role        AssignmentRole   @default(PRIMARY)
  status      AssignmentStatus @default(ACTIVE)
  assignedAt  DateTime         @default(now())
  completedAt DateTime?

  @@unique([projectId, userId])
  @@index([userId])
  @@index([projectId])
  @@map("project_assignments")
}
```

- [ ] **Step 3: Remove pmId/developerId from Project model**

In the Project model, remove these lines:
```prisma
  pmId        String
  pm          User            @relation("ProjectManager", fields: [pmId], references: [id])
  developerId String?
  developer   User?           @relation("ProjectDeveloper", fields: [developerId], references: [id])
```

Add this relation instead:
```prisma
  assignments ProjectAssignment[]
```

- [ ] **Step 4: Update User model relations**

In the User model, remove:
```prisma
  managedProjects  Project[]       @relation("ProjectManager")
  assignedProjects Project[]       @relation("ProjectDeveloper")
```

Add:
```prisma
  assignments      ProjectAssignment[]
```

- [ ] **Step 5: Generate Prisma client**

Run:
```bash
cd backend && npx prisma generate
```

Expected: Prisma client regenerated with new types. No migration yet — we'll reset the DB after all schema changes.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat: add ProjectAssignment model, remove pmId/developerId from Project"
```

---

## Task 2: Seed Data — Assignments Instead of pmId/developerId

**Files:**
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Rewrite seed to create assignments**

The current seed creates users but no projects. Projects are created at runtime by PMs. The seed needs to:
1. Keep all user creation as-is
2. Remove any references to `pmId`/`developerId` if project creation is added later
3. No project seeding exists currently, so no migration needed

The seed file is already correct for users. Just verify it still works after schema changes.

However, we should add some sample projects WITH assignments so the KPI dashboard has data to display. Add this section after all user creation (before the final console.log):

```typescript
  // ─── 5. Create Sample Projects with Assignments ─────
  console.log('\nCreating sample projects with assignments...');

  // Fetch created users for reference
  const azhar = await prisma.user.findUnique({ where: { email: 'pm.azhar@company.com' } });
  const mujtaba = await prisma.user.findUnique({ where: { email: 'pm.mujtaba@company.com' } });
  const rehan = await prisma.user.findUnique({ where: { email: 'pm.rehan@company.com' } });
  const huzaifa = await prisma.user.findUnique({ where: { email: 'pm.huzaifa@company.com' } });
  const aqsa = await prisma.user.findUnique({ where: { email: 'pm.aqsa@company.com' } });
  const abubakar = await prisma.user.findUnique({ where: { email: 'prod1@company.com' } });
  const arshan = await prisma.user.findUnique({ where: { email: 'prod2@company.com' } });
  const syedTaha = await prisma.user.findUnique({ where: { email: 'prod3@company.com' } });
  const syedMuslim = await prisma.user.findUnique({ where: { email: 'prod4@company.com' } });
  const syedRayyan = await prisma.user.findUnique({ where: { email: 'prod5@company.com' } });
  const tahir = await prisma.user.findUnique({ where: { email: 'prod6@company.com' } });
  const binSaud = await prisma.user.findUnique({ where: { email: 'prod7@company.com' } });
  const qasim = await prisma.user.findUnique({ where: { email: 'prod8@company.com' } });
  const syedAkbar = await prisma.user.findUnique({ where: { email: 'prod9@company.com' } });
  const anas = await prisma.user.findUnique({ where: { email: 'prod10@company.com' } });
  const shakeeb = await prisma.user.findUnique({ where: { email: 'prod11@company.com' } });

  if (azhar && mujtaba && rehan && abubakar && arshan && syedTaha && syedMuslim && syedRayyan && tahir && binSaud && qasim && syedAkbar && anas && shakeeb) {
    const boards = {
      logo: await prisma.board.findUnique({ where: { slug: 'logo-design' } }),
      webDesign: await prisma.board.findUnique({ where: { slug: 'web-design' } }),
      webDev: await prisma.board.findUnique({ where: { slug: 'web-development' } }),
      content: await prisma.board.findUnique({ where: { slug: 'content' } }),
    };

    const sampleProjects = [
      // Team 1, Web Dev board — multiple assignments
      { name: 'ABC Corp Website', boardSlug: 'web-development', teamSlug: 'team-1', status: 'completed', priority: 'HIGH' as const, minorChanges: 5, majorChanges: 2, assignments: [
        { userId: azhar!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: abubakar!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: arshan!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: syedAkbar!.id, role: 'COLLABORATOR' as const, status: 'DONE' as const },
      ]},
      { name: 'XYZ Landing Page', boardSlug: 'web-development', teamSlug: 'team-1', status: 'in-progress', priority: 'MEDIUM' as const, minorChanges: 2, majorChanges: 0, assignments: [
        { userId: azhar!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
        { userId: syedTaha!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
        { userId: binSaud!.id, role: 'COLLABORATOR' as const, status: 'DONE' as const },
      ]},
      { name: 'StartupHub Platform', boardSlug: 'web-development', teamSlug: 'team-1', status: 'live', priority: 'CRITICAL' as const, minorChanges: 8, majorChanges: 3, assignments: [
        { userId: mujtaba!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: syedRayyan!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: arshan!.id, role: 'COLLABORATOR' as const, status: 'DONE' as const },
        { userId: shakeeb!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: tahir!.id, role: 'COLLABORATOR' as const, status: 'DONE' as const },
      ]},
      // Team 2, Logo board
      { name: 'TechVenture Logo', boardSlug: 'logo-design', teamSlug: 'team-2', status: 'completed', priority: 'MEDIUM' as const, minorChanges: 3, majorChanges: 1, assignments: [
        { userId: rehan!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: syedMuslim!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: qasim!.id, role: 'COLLABORATOR' as const, status: 'DONE' as const },
      ]},
      { name: 'GreenLeaf Branding', boardSlug: 'logo-design', teamSlug: 'team-2', status: 'in-progress', priority: 'LOW' as const, minorChanges: 1, majorChanges: 0, assignments: [
        { userId: rehan!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
        { userId: qasim!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
      ]},
      // Team 1, Web Design board
      { name: 'FoodDelivery App UI', boardSlug: 'web-design', teamSlug: 'team-1', status: 'revisions', priority: 'HIGH' as const, minorChanges: 4, majorChanges: 2, assignments: [
        { userId: mujtaba!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
        { userId: arshan!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
        { userId: binSaud!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
      ]},
      // Team 2, Content board
      { name: 'TechBlog Launch Content', boardSlug: 'content', teamSlug: 'team-2', status: 'completed', priority: 'MEDIUM' as const, minorChanges: 2, majorChanges: 0, assignments: [
        { userId: rehan!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: tahir!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: anas!.id, role: 'COLLABORATOR' as const, status: 'DONE' as const },
      ]},
      { name: 'SaaS Product Copy', boardSlug: 'content', teamSlug: 'team-2', status: 'in-progress', priority: 'HIGH' as const, minorChanges: 0, majorChanges: 0, assignments: [
        { userId: aqsa!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
        { userId: anas!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
      ]},
      // More web dev for richer KPI data
      { name: 'E-Commerce Platform', boardSlug: 'web-development', teamSlug: 'team-2', status: 'in-progress', priority: 'CRITICAL' as const, minorChanges: 6, majorChanges: 1, assignments: [
        { userId: rehan!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
        { userId: abubakar!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
        { userId: syedRayyan!.id, role: 'COLLABORATOR' as const, status: 'ACTIVE' as const },
        { userId: arshan!.id, role: 'COLLABORATOR' as const, status: 'DONE' as const },
        { userId: syedAkbar!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
      ]},
      { name: 'Portfolio Revamp', boardSlug: 'web-development', teamSlug: 'team-1', status: 'live', priority: 'MEDIUM' as const, minorChanges: 3, majorChanges: 1, assignments: [
        { userId: azhar!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: syedTaha!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: shakeeb!.id, role: 'COLLABORATOR' as const, status: 'DONE' as const },
      ]},
    ];

    for (const proj of sampleProjects) {
      const board = boards[proj.boardSlug === 'web-development' ? 'webDev' : proj.boardSlug === 'web-design' ? 'webDesign' : proj.boardSlug === 'logo-design' ? 'logo' : 'content'];
      if (!board) continue;

      const project = await prisma.project.create({
        data: {
          name: proj.name,
          boardId: board.id,
          teamId: teams[proj.teamSlug].id,
          status: proj.status,
          priority: proj.priority,
          minorChanges: proj.minorChanges,
          majorChanges: proj.majorChanges,
        },
      });

      for (const a of proj.assignments) {
        await prisma.projectAssignment.create({
          data: {
            projectId: project.id,
            userId: a.userId,
            role: a.role,
            status: a.status,
            completedAt: a.status === 'DONE' ? new Date() : null,
          },
        });
      }

      console.log(`✅ Project: ${proj.name} (${proj.assignments.length} members)`);
    }
  }
```

- [ ] **Step 2: Run migration reset + seed**

```bash
cd backend && npx prisma migrate reset --force
```

This will drop the DB, reapply all migrations, and run the seed. Since the schema changed (removed pmId/developerId), we need a fresh migration:

```bash
cd backend && npx prisma migrate dev --name add_project_assignments
```

Expected: Migration created, Prisma client regenerated, seed runs and creates sample projects with assignments.

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/seed.ts backend/prisma/migrations/
git commit -m "feat: seed sample projects with ProjectAssignment data"
```

---

## Task 3: Validators — Assignment Schemas

**Files:**
- Modify: `backend/src/utils/validators.ts`

- [ ] **Step 1: Add assignment schemas**

After the existing `createClientSchema`, add:

```typescript
export const createAssignmentSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: z.enum(['PRIMARY', 'COLLABORATOR']).optional().default('PRIMARY'),
});

export const updateAssignmentSchema = z.object({
  role: z.enum(['PRIMARY', 'COLLABORATOR']).optional(),
  status: z.enum(['ACTIVE', 'DONE']).optional(),
});
```

- [ ] **Step 2: Remove developerId from project schemas**

In `createProjectSchema`, remove:
```typescript
  developerId: z.string().optional().nullable(),
```

In `updateProjectSchema`, remove:
```typescript
  developerId: z.string().uuid().optional().nullable(),
```

Also remove `pmId` if it's anywhere in these schemas (currently it's not in the validator — it's handled in the controller).

- [ ] **Step 3: Commit**

```bash
git add backend/src/utils/validators.ts
git commit -m "feat: add assignment validators, remove developerId from project schemas"
```

---

## Task 4: Assignment Controller — CRUD Operations

**Files:**
- Create: `backend/src/controllers/assignment.controller.ts`

- [ ] **Step 1: Create the assignment controller**

```typescript
import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// ─── Add Member to Project ──────────────────────────

export const addAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { userId, role } = req.body;

    // Verify project exists
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Check for duplicate assignment
    const existing = await prisma.projectAssignment.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (existing) {
      res.status(409).json({ success: false, message: `${user.name} is already assigned to this project` });
      return;
    }

    const assignment = await prisma.projectAssignment.create({
      data: {
        projectId,
        userId,
        role: role || 'PRIMARY',
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true, role: true, specialization: true } },
      },
    });

    res.status(201).json({ success: true, message: 'Member added', data: { assignment } });
  } catch (error) {
    console.error('Add assignment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Update Assignment (role or status) ─────────────

export const updateAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { assignmentId } = req.params;
    const { role, status } = req.body;

    const existing = await prisma.projectAssignment.findUnique({ where: { id: assignmentId } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Assignment not found' });
      return;
    }

    // Permission check for status toggle: own assignment OR PM/TL
    if (status && existing.userId !== req.user?.id) {
      const requester = await prisma.user.findUnique({ where: { id: req.user?.id }, select: { role: true } });
      if (requester?.role !== 'PM' && requester?.role !== 'TL') {
        res.status(403).json({ success: false, message: 'You can only toggle your own assignment status' });
        return;
      }
    }

    const updateData: Record<string, unknown> = {};
    if (role) updateData.role = role;
    if (status) {
      updateData.status = status;
      updateData.completedAt = status === 'DONE' ? new Date() : null;
    }

    const assignment = await prisma.projectAssignment.update({
      where: { id: assignmentId },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true, role: true, specialization: true } },
      },
    });

    res.status(200).json({ success: true, message: 'Assignment updated', data: { assignment } });
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Remove Assignment ──────────────────────────────

export const removeAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { assignmentId } = req.params;

    const existing = await prisma.projectAssignment.findUnique({ where: { id: assignmentId } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Assignment not found' });
      return;
    }

    await prisma.projectAssignment.delete({ where: { id: assignmentId } });

    res.status(200).json({ success: true, message: 'Member removed from project' });
  } catch (error) {
    console.error('Remove assignment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/controllers/assignment.controller.ts
git commit -m "feat: add assignment controller with CRUD operations"
```

---

## Task 5: Assignment Routes

**Files:**
- Create: `backend/src/routes/assignment.routes.ts`
- Modify: `backend/src/routes/project.routes.ts`

- [ ] **Step 1: Create assignment routes file**

```typescript
import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { addAssignment, updateAssignment, removeAssignment } from '../controllers/assignment.controller';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.post('/', addAssignment);
router.put('/:assignmentId', updateAssignment);
router.delete('/:assignmentId', removeAssignment);

export default router;
```

- [ ] **Step 2: Mount in project routes**

In `backend/src/routes/project.routes.ts`, add at the top with other imports:

```typescript
import assignmentRoutes from './assignment.routes';
```

Then before the existing label routes (around line 70), add:

```typescript
// Assignment routes (nested under /api/projects/:id/assignments)
router.use('/:id/assignments', assignmentRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/assignment.routes.ts backend/src/routes/project.routes.ts
git commit -m "feat: add assignment routes mounted under /api/projects/:id/assignments"
```

---

## Task 6: Update Project Controller — Remove pmId/developerId Logic

**Files:**
- Modify: `backend/src/controllers/project.controller.ts`

- [ ] **Step 1: Update projectIncludes**

Replace the current `projectIncludes` object (lines 16-34) with:

```typescript
const projectIncludes = {
  assignments: {
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true, role: true, specialization: true } },
    },
    orderBy: { assignedAt: 'asc' as const },
  },
  comments: {
    include: { user: { select: { id: true, name: true, avatar: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  checklist: { orderBy: { position: 'asc' as const } },
  labels: { include: { label: true } },
  attachments: { orderBy: { uploadedAt: 'desc' as const } },
  activities: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' as const },
    take: 20,
  },
  board: { select: { id: true, name: true, slug: true } },
  team: { select: { id: true, name: true, slug: true } },
  client: { select: { id: true, name: true, contactEmail: true } },
};
```

- [ ] **Step 2: Rewrite createProject**

The key changes to `createProject`:
1. No more `pmId` or `developerId` in the create data
2. The PM (creator) is auto-assigned as the first ProjectAssignment with role=PRIMARY
3. `teamId` is determined from the creator's team membership (req.user)
4. Remove PM role check — any member can be assigned via assignments after creation
5. Keep the Google Sheets sync working — derive PM name from the creator

Replace the createProject function body. The new logic:

```typescript
export const createProject = async (req: Request, res: Response): Promise<void> => {
  try {
    let { name, boardId, description, priority, dueDate, image, status, clientId } = req.body;

    const creatorId = req.user?.id;
    if (!name || !boardId || !creatorId) {
      res.status(400).json({ success: false, message: 'Name and boardId are required' });
      return;
    }

    // Resolve board: accept either UUID or slug
    let board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) {
      board = await prisma.board.findUnique({ where: { slug: boardId } });
    }
    if (!board) {
      res.status(404).json({ success: false, message: 'Board not found' });
      return;
    }
    boardId = board.id;

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

    // Validate status against board columns if provided
    if (status) {
      const column = await prisma.boardColumn.findUnique({
        where: { boardId_key: { boardId, key: status } },
      });
      if (!column) {
        res.status(400).json({ success: false, message: `Invalid status "${status}" for this board` });
        return;
      }
    }

    // Create project (no pmId/developerId)
    const project = await prisma.project.create({
      data: {
        name,
        boardId,
        teamId,
        description,
        status: status || 'todo',
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        image: image || null,
        clientId: clientId || null,
      },
      include: projectIncludes,
    });

    // Auto-assign creator as first member (PRIMARY)
    await prisma.projectAssignment.create({
      data: { projectId: project.id, userId: creatorId, role: 'PRIMARY' },
    });

    // Re-fetch to include the new assignment
    const fullProject = await prisma.project.findUnique({
      where: { id: project.id },
      include: projectIncludes,
    });

    // Log activity
    await prisma.activityLog.create({
      data: { action: `Created project: ${name}`, projectId: project.id, userId: creatorId },
    });

    // Notify all PRODUCTION users about the new project
    const creatorUser = await prisma.user.findUnique({ where: { id: creatorId }, select: { name: true } });
    const productionUsers = await prisma.user.findMany({
      where: { role: 'PRODUCTION' },
      select: { id: true },
    });
    const prodNotifItems = productionUsers
      .filter(u => u.id !== creatorId)
      .map(u => ({
        type: 'project_created',
        message: `${creatorUser?.name || 'Someone'} created a new project: ${name}`,
        userId: u.id,
        projectId: project.id,
        actorId: creatorId,
      }));
    await createManyNotifications(prodNotifItems);

    // Google Sheets sync (fire-and-forget)
    (async () => {
      try {
        const initialColumn = await prisma.boardColumn.findFirst({
          where: { boardId, key: fullProject?.status || 'todo' },
          select: { name: true },
        });
        await appendProjectRow({
          projectName: name,
          pmName: creatorUser?.name || '',
          assignedTo: '',
          role: getBoardRole(board!.name),
          taskType: board!.name,
          dateAssigned: format(project.createdAt, 'MM/dd/yyyy'),
          eta: project.dueDate ? format(new Date(project.dueDate), 'MM/dd/yyyy') : '',
          status: initialColumn?.name || 'To Do',
          crmId: project.id,
        });
      } catch (err) {
        console.error('[GoogleSheets] createProject sync failed:', err);
      }
    })();

    res.status(201).json({
      success: true,
      message: 'Project created',
      data: { project: fullProject },
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
```

- [ ] **Step 3: Update updateProject**

In `updateProject`, remove:
1. The `pmId` validation block (lines 311-316):
```typescript
    if (updateData.pmId) { ... }
```
2. The `developerId` validation block (lines 318-322):
```typescript
    if (updateData.developerId) { ... }
```
3. The developer assignment notification (lines 347-356):
```typescript
    if (updateData.developerId && updateData.developerId !== existing.developerId ...) { ... }
```
4. In the status change notification (lines 359-374), replace `existing.pmId` and `existing.developerId` with a query to get all assigned users:
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
```
5. Replace the CRITICAL priority notification (lines 377-388) — notify all assigned members instead of just developerId:
```typescript
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

Also remove `pmId` and `developerId` from the `finalData` spread if they come through `updateData` — add a cleanup:
```typescript
    delete updateData.pmId;
    delete updateData.developerId;
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/project.controller.ts
git commit -m "refactor: replace pmId/developerId with assignments in project controller"
```

---

## Task 7: Update Dashboard Controller

**Files:**
- Modify: `backend/src/controllers/dashboard.controller.ts`

- [ ] **Step 1: Update getMyDashboardStats**

The `getMyDashboardStats` function currently queries by `pmId` and `developerId`. Replace with assignment queries.

In the board stats section, replace the `managed`/`assigned` counts with a single `myProjects` count via assignments:

Replace the per-board counting logic with:
```typescript
    // Get all project IDs the user is assigned to
    const myAssignments = await prisma.projectAssignment.findMany({
      where: { userId: user.id },
      select: { projectId: true },
    });
    const myProjectIds = myAssignments.map(a => a.projectId);

    // Get board breakdown for assigned projects
    const boardBreakdown = await prisma.project.groupBy({
      by: ['boardId'],
      where: { id: { in: myProjectIds } },
      _count: { id: true },
    });

    const boardIds = boardBreakdown.map(b => b.boardId);
    const boardsInfo = await prisma.board.findMany({
      where: { id: { in: boardIds } },
      select: { id: true, name: true, slug: true },
    });

    const breakdown: Record<string, { name: string; count: number }> = {};
    for (const b of boardBreakdown) {
      const info = boardsInfo.find(bi => bi.id === b.boardId);
      if (info) {
        breakdown[info.slug] = { name: info.name, count: b._count.id };
      }
    }
```

Update the recent projects query to use assignment IDs:
```typescript
    const myRecentProjects = await prisma.project.findMany({
      where: { id: { in: myProjectIds } },
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

Return updated shape:
```typescript
    res.status(200).json({
      success: true,
      data: {
        myBoardStats: {
          breakdown,
          totalProjects: myProjectIds.length,
        },
        myRecentProjects,
      },
    });
```

- [ ] **Step 2: Update getDashboardOverview**

In `getDashboardOverview`, the recent projects query currently includes `pm` and `developer`. Replace with `assignments`:

```typescript
    const recentProjects = await prisma.project.findMany({
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

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/dashboard.controller.ts
git commit -m "refactor: replace pmId/developerId with assignment queries in dashboard"
```

---

## Task 8: Update Admin Controller — Employee Stats & Performance KPIs

**Files:**
- Modify: `backend/src/controllers/admin.controller.ts`

- [ ] **Step 1: Rewrite getEmployees with assignment-based stats**

Replace the batched aggregation section (lines 106-168) with assignment-based queries:

```typescript
export const getEmployees = async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        specialization: true,
        avatar: true,
        createdAt: true,
        teamMembers: {
          include: {
            team: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Batched assignment stats
    const [activeAssignments, doneAssignments, revenueByUser] = await Promise.all([
      prisma.projectAssignment.groupBy({
        by: ['userId'],
        _count: { id: true },
        where: { status: 'ACTIVE' },
      }),
      prisma.projectAssignment.groupBy({
        by: ['userId'],
        _count: { id: true },
        where: { status: 'DONE' },
      }),
      prisma.invoice.groupBy({
        by: ['createdById'],
        _sum: { amount: true },
        where: { status: 'PAID' },
      }),
    ]);

    const activeMap = new Map(activeAssignments.map(r => [r.userId, r._count.id]));
    const doneMap = new Map(doneAssignments.map(r => [r.userId, r._count.id]));
    const revenueMap = new Map(revenueByUser.map(r => [r.createdById, Number(r._sum.amount) || 0]));

    const employees = users.map(user => {
      const teams = user.teamMembers.map(m => m.team);
      const stats: Record<string, unknown> = {
        activeProjects: activeMap.get(user.id) || 0,
        completedProjects: doneMap.get(user.id) || 0,
      };

      if (user.role === 'PM' || user.role === 'TL' || user.role === 'EXECUTIVE') {
        stats.totalRevenue = revenueMap.get(user.id) || 0;
      }

      const { teamMembers: _tm, ...userWithoutTeamMembers } = user;
      return { ...userWithoutTeamMembers, teams, stats };
    });

    res.status(200).json({ success: true, message: 'Data retrieved successfully', data: { employees } });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
```

- [ ] **Step 2: Rewrite getEmployeePerformance**

Complete rewrite for the new KPI structure:

```typescript
export const getEmployeePerformance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, username: true, email: true, role: true, specialization: true, avatar: true, createdAt: true,
        teamMembers: { include: { team: { select: { id: true, name: true, slug: true } } } },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'Employee not found' });
      return;
    }

    const teams = user.teamMembers.map(m => m.team);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Common: assignment stats
    const [activeAssignments, doneAssignments, primaryCount, collaboratorCount, assignmentsByBoard] = await Promise.all([
      prisma.projectAssignment.count({ where: { userId: id, status: 'ACTIVE' } }),
      prisma.projectAssignment.count({ where: { userId: id, status: 'DONE' } }),
      prisma.projectAssignment.count({ where: { userId: id, role: 'PRIMARY' } }),
      prisma.projectAssignment.count({ where: { userId: id, role: 'COLLABORATOR' } }),
      prisma.projectAssignment.findMany({
        where: { userId: id },
        select: { project: { select: { boardId: true } } },
      }),
    ]);

    // Group by board
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

    let performance: Record<string, unknown> = {
      activeProjects: activeAssignments,
      completedProjects: doneAssignments,
      asPrimary: primaryCount,
      asCollaborator: collaboratorCount,
      projectsByBoard,
    };

    if (user.role === 'PM' || user.role === 'TL') {
      // Sales-specific: revenue + invoices
      const [totalRevenueResult, revenueThisMonthResult, invoiceCounts, avgInvoiceResult, distinctClients, newClientsThisMonth] = await Promise.all([
        prisma.invoice.aggregate({ _sum: { amount: true }, where: { createdById: id, status: 'PAID' } }),
        prisma.invoice.aggregate({ _sum: { amount: true }, where: { createdById: id, status: 'PAID', paidAt: { gte: startOfMonth } } }),
        prisma.invoice.groupBy({ by: ['status'], _count: { id: true }, _sum: { amount: true }, where: { createdById: id } }),
        prisma.invoice.aggregate({ _avg: { amount: true }, where: { createdById: id, status: 'PAID' } }),
        prisma.invoice.findMany({ where: { createdById: id }, select: { clientName: true }, distinct: ['clientName'] }),
        prisma.invoice.findMany({
          where: { createdById: id, createdAt: { gte: startOfMonth } },
          select: { clientName: true },
          distinct: ['clientName'],
        }),
      ]);

      const invoiceBreakdown: Record<string, { count: number; amount: number }> = {};
      let totalInvoicesSent = 0;
      for (const row of invoiceCounts) {
        invoiceBreakdown[row.status] = { count: row._count.id, amount: Number(row._sum.amount) || 0 };
        totalInvoicesSent += row._count.id;
      }

      performance = {
        ...performance,
        totalRevenue: Number(totalRevenueResult._sum.amount) || 0,
        revenueThisMonth: Number(revenueThisMonthResult._sum.amount) || 0,
        averageInvoiceValue: Number(avgInvoiceResult._avg.amount) || 0,
        totalInvoicesSent,
        invoiceBreakdown,
        totalClients: distinctClients.length,
        newClientsThisMonth: newClientsThisMonth.length,
      };

      // TL-specific: team aggregate
      if (user.role === 'TL') {
        const teamIds = teams.map(t => t.id);

        if (teamIds.length > 0) {
          const teamMemberRecords = await prisma.teamMember.findMany({
            where: { teamId: { in: teamIds } },
            include: { user: { select: { id: true, name: true, role: true, username: true, avatar: true, specialization: true } } },
          });
          const teamUserIds = teamMemberRecords.map(tm => tm.user.id);

          const [teamRevenueResult, teamRevenueThisMonth, teamInvoiceCounts, teamActiveAssignments, teamDoneAssignments] = await Promise.all([
            prisma.invoice.aggregate({ _sum: { amount: true }, where: { createdById: { in: teamUserIds }, status: 'PAID' } }),
            prisma.invoice.aggregate({ _sum: { amount: true }, where: { createdById: { in: teamUserIds }, status: 'PAID', paidAt: { gte: startOfMonth } } }),
            prisma.invoice.groupBy({ by: ['status'], _count: { id: true }, _sum: { amount: true }, where: { createdById: { in: teamUserIds } } }),
            prisma.projectAssignment.groupBy({ by: ['userId'], _count: { id: true }, where: { userId: { in: teamUserIds }, status: 'ACTIVE' } }),
            prisma.projectAssignment.groupBy({ by: ['userId'], _count: { id: true }, where: { userId: { in: teamUserIds }, status: 'DONE' } }),
          ]);

          // Per-user revenue for team member rows
          const perUserRevenue = await prisma.invoice.groupBy({
            by: ['createdById'],
            _sum: { amount: true },
            where: { createdById: { in: teamUserIds }, status: 'PAID' },
          });
          const userRevenueMap = new Map(perUserRevenue.map(r => [r.createdById, Number(r._sum.amount) || 0]));
          const userActiveMap = new Map(teamActiveAssignments.map(r => [r.userId, r._count.id]));
          const userDoneMap = new Map(teamDoneAssignments.map(r => [r.userId, r._count.id]));

          const teamInvoiceBreakdown: Record<string, { count: number; amount: number }> = {};
          for (const row of teamInvoiceCounts) {
            teamInvoiceBreakdown[row.status] = { count: row._count.id, amount: Number(row._sum.amount) || 0 };
          }

          const teamMembers = teamMemberRecords.map(tm => ({
            ...tm.user,
            teamId: tm.teamId,
            revenue: userRevenueMap.get(tm.user.id) || 0,
            activeProjects: userActiveMap.get(tm.user.id) || 0,
            completedProjects: userDoneMap.get(tm.user.id) || 0,
          }));

          performance.team = {
            totalRevenue: Number(teamRevenueResult._sum.amount) || 0,
            revenueThisMonth: Number(teamRevenueThisMonth._sum.amount) || 0,
            invoiceBreakdown: teamInvoiceBreakdown,
            activeProjects: teamActiveAssignments.reduce((sum, r) => sum + r._count.id, 0),
            completedProjects: teamDoneAssignments.reduce((sum, r) => sum + r._count.id, 0),
            members: teamMembers,
          };
        }
      }
    } else if (user.role === 'PRODUCTION') {
      // Production-specific stats
      const assignedProjectIds = await prisma.projectAssignment.findMany({
        where: { userId: id },
        select: { projectId: true },
      });
      const projectIds = assignedProjectIds.map(a => a.projectId);

      const [liveProjects, changesResult] = await Promise.all([
        prisma.project.count({ where: { id: { in: projectIds }, status: 'live' } }),
        prisma.project.aggregate({ _sum: { minorChanges: true, majorChanges: true }, where: { id: { in: projectIds } } }),
      ]);

      const totalMinorChanges = changesResult._sum.minorChanges || 0;
      const totalMajorChanges = changesResult._sum.majorChanges || 0;
      const totalAssigned = projectIds.length;

      performance = {
        ...performance,
        specialization: user.specialization,
        liveProjects,
        totalMinorChanges,
        totalMajorChanges,
        averageChangesPerProject: totalAssigned > 0 ? Math.round((totalMinorChanges + totalMajorChanges) / totalAssigned * 10) / 10 : 0,
        completionRatio: totalAssigned > 0 ? Math.round((doneAssignments / totalAssigned) * 100) : 0,
      };
    }

    const { teamMembers: _tm, ...userInfo } = user;
    res.status(200).json({
      success: true,
      message: 'Data retrieved successfully',
      data: {
        performance: {
          user: { ...userInfo, teams },
          role: user.role,
          ...performance,
        },
      },
    });
  } catch (error) {
    console.error('Get employee performance error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
```

- [ ] **Step 3: Update deleteEmployee**

Replace the PM project check and PRODUCTION developerId nullification:

```typescript
    // Instead of checking pmId, check if user has ACTIVE assignments
    if (user.role === 'PM') {
      const activeAssignments = await prisma.projectAssignment.count({
        where: { userId: id, status: 'ACTIVE' },
      });
      if (activeAssignments > 0) {
        res.status(400).json({
          success: false,
          message: `Cannot delete ${user.name} — they have ${activeAssignments} active project assignments. Remove them from projects first.`,
        });
        return;
      }
    }

    // Delete all assignments for this user (instead of nullifying developerId)
    await prisma.projectAssignment.deleteMany({ where: { userId: id } });
```

Remove the old blocks:
```typescript
    // REMOVE: if (user.role === 'PM') { const projectCount = ... }
    // REMOVE: if (user.role === 'PRODUCTION') { await prisma.project.updateMany({ where: { developerId: id }, ... }) }
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/admin.controller.ts
git commit -m "refactor: rewrite admin KPIs with assignment-based performance tracking"
```

---

## Task 9: Frontend Types — Assignment Types & Updated Interfaces

**Files:**
- Modify: `frontend/lib/types.ts`

- [ ] **Step 1: Add assignment types**

After the existing `Specialization` type, add:

```typescript
export type AssignmentRole = 'PRIMARY' | 'COLLABORATOR';
export type AssignmentStatus = 'ACTIVE' | 'DONE';

export interface ProjectAssignment {
  id: string;
  projectId: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    role: string;
    specialization?: Specialization;
  };
  role: AssignmentRole;
  status: AssignmentStatus;
  assignedAt: string;
  completedAt: string | null;
}
```

- [ ] **Step 2: Update Project interface**

Replace:
```typescript
  pm: string;
  developer: string | null;
```

With:
```typescript
  assignments: ProjectAssignment[];
```

- [ ] **Step 3: Replace performance types**

Remove the existing `PMPerformance`, `TLPerformance`, `ProductionPerformance`, and `EmployeePerformance` types. Replace with:

```typescript
export interface InvoiceBreakdown {
  [status: string]: { count: number; amount: number };
}

export interface BoardBreakdown {
  boardId: string;
  boardName: string;
  boardSlug: string;
  count: number;
}

export interface TeamMemberStats {
  id: string;
  name: string;
  role: string;
  username: string;
  avatar: string | null;
  specialization?: Specialization;
  teamId: string;
  revenue: number;
  activeProjects: number;
  completedProjects: number;
}

export interface TeamAggregate {
  totalRevenue: number;
  revenueThisMonth: number;
  invoiceBreakdown: InvoiceBreakdown;
  activeProjects: number;
  completedProjects: number;
  members: TeamMemberStats[];
}

export interface EmployeePerformance {
  user: {
    id: string;
    name: string;
    username: string;
    email: string;
    role: string;
    specialization?: Specialization;
    avatar: string | null;
    createdAt: string;
    teams: { id: string; name: string; slug: string }[];
  };
  role: string;
  // Common
  activeProjects: number;
  completedProjects: number;
  asPrimary: number;
  asCollaborator: number;
  projectsByBoard: BoardBreakdown[];
  // Sales (PM/TL)
  totalRevenue?: number;
  revenueThisMonth?: number;
  averageInvoiceValue?: number;
  totalInvoicesSent?: number;
  invoiceBreakdown?: InvoiceBreakdown;
  totalClients?: number;
  newClientsThisMonth?: number;
  // TL team
  team?: TeamAggregate;
  // Production
  specialization?: Specialization;
  liveProjects?: number;
  totalMinorChanges?: number;
  totalMajorChanges?: number;
  averageChangesPerProject?: number;
  completionRatio?: number;
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/types.ts
git commit -m "feat: add assignment types, update Project and performance interfaces"
```

---

## Task 10: Frontend API Service — Assignment API

**Files:**
- Modify: `frontend/lib/api-service.ts`

- [ ] **Step 1: Add assignmentAPI**

After the existing `clientAPI` object, add:

```typescript
export const assignmentAPI = {
  add: async (projectId: string, userId: string, role: string = 'PRIMARY') => {
    const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/assignments`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    });
    return await response.json();
  },
  update: async (projectId: string, assignmentId: string, data: { role?: string; status?: string }) => {
    const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/assignments/${assignmentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return await response.json();
  },
  remove: async (projectId: string, assignmentId: string) => {
    const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/assignments/${assignmentId}`, {
      method: 'DELETE',
    });
    return await response.json();
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/api-service.ts
git commit -m "feat: add assignmentAPI to frontend API service"
```

---

## Task 11: Frontend Context — Update mapApiProject

**Files:**
- Modify: `frontend/contexts/AppContext.tsx`

- [ ] **Step 1: Update mapApiProject**

In the `mapApiProject` function, replace:
```typescript
      pm: p.pmId || p.pm?.id || '',
      developer: p.developerId || p.developer?.id || null,
```

With:
```typescript
      assignments: (p.assignments || []).map((a: any) => ({
        id: a.id,
        projectId: a.projectId,
        userId: a.userId || a.user?.id,
        user: a.user ? {
          id: a.user.id,
          name: a.user.name,
          email: a.user.email,
          avatar: a.user.avatar || null,
          role: a.user.role,
          specialization: a.user.specialization || undefined,
        } : null,
        role: a.role || 'PRIMARY',
        status: a.status || 'ACTIVE',
        assignedAt: a.assignedAt,
        completedAt: a.completedAt || null,
      })),
```

Also update the labels mapping — keep it for actual labels only. The current label mapping should still work since `ProjectLabel` still exists. No change needed there.

- [ ] **Step 2: Update any references to `project.pm` or `project.developer` in AppContext**

Search for uses of `.pm` or `.developer` in AppContext and update. The `getUserName` and `getUserAvatar` calls that reference PM should now look up from `project.assignments`.

- [ ] **Step 3: Commit**

```bash
git add frontend/contexts/AppContext.tsx
git commit -m "refactor: update mapApiProject for assignments instead of pm/developer"
```

---

## Task 12: Frontend — Card.tsx Member Display with Assignments

**Files:**
- Modify: `frontend/components/kanban/Card.tsx`

- [ ] **Step 1: Replace label-based member logic with assignments**

The card currently reads members from `project.labels` and uses `projectAPI.addLabel` / `projectAPI.removeLabel`. Replace all of this with the assignment system.

Key changes:
1. Member avatars come from `project.assignments` instead of `project.labels`
2. DONE members get a green checkmark overlay on their avatar
3. "Add Member" uses `assignmentAPI.add` with a role picker (Primary/Collaborator)
4. Remove member uses `assignmentAPI.remove`
5. The member search modal stays the same UI but calls assignment API
6. Remove the role badge that was already removed in the earlier fix

Replace `handleAddMember`:
```typescript
  const handleAddMember = async (userId: string, role: string = 'PRIMARY') => {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    if (project.assignments.some(a => a.userId === userId)) {
      toast.info(`${user.name} is already assigned`);
      setShowTagModal(false);
      setSearchQuery('');
      return;
    }

    try {
      const result = await assignmentAPI.add(project.id, userId, role);
      if (result.success) {
        const newAssignment = result.data.assignment;
        const updatedProject = {
          ...project,
          assignments: [...project.assignments, newAssignment],
          updatedAt: new Date(),
        };
        dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
        toast.success(`${user.name} added as ${role.toLowerCase()}`);
      }
    } catch (error) {
      console.error('Error adding member:', error);
      toast.error('Failed to add member');
    }

    setShowTagModal(false);
    setSearchQuery('');
  };
```

Replace `handleRemoveMember`:
```typescript
  const handleRemoveMember = async (e: React.MouseEvent, assignmentId: string) => {
    e.stopPropagation();
    try {
      await assignmentAPI.remove(project.id, assignmentId);
    } catch (error) {
      console.error('Error removing member:', error);
    }
    const updatedProject = {
      ...project,
      assignments: project.assignments.filter(a => a.id !== assignmentId),
      updatedAt: new Date(),
    };
    dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
  };
```

Replace the member avatars section (currently reads `project.labels`) with:
```tsx
        {/* Members */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {project.assignments.length > 0 && (
            <div className="flex -space-x-1.5">
              {project.assignments.slice(0, 5).map((assignment) => {
                const memberAvatar = assignment.user?.avatar ? getUserAvatar(assignment.userId) : undefined;
                return (
                  <div key={assignment.id} className="relative group/member">
                    <div className="relative">
                      <Avatar className="w-6 h-6 border-2 border-white dark:border-[#1a1f2e] cursor-pointer">
                        <AvatarImage src={memberAvatar} alt={assignment.user?.name} />
                        <AvatarFallback className="text-[8px] bg-orange-500 text-white font-bold">
                          {getInitials(assignment.user?.name || '')}
                        </AvatarFallback>
                      </Avatar>
                      {assignment.status === 'DONE' && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border border-white dark:border-[#1a1f2e] flex items-center justify-center">
                          <CheckCircle2 className="w-2 h-2 text-white" />
                        </div>
                      )}
                    </div>
                    {/* Tooltip + remove on hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/member:flex flex-col items-center z-40">
                      <span className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap shadow-lg">
                        {assignment.user?.name} ({assignment.role === 'PRIMARY' ? 'Primary' : 'Collab'})
                      </span>
                      {!isReadOnly && (
                        <button
                          onClick={(e) => handleRemoveMember(e, assignment.id)}
                          className="mt-0.5 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded hover:bg-red-600 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {project.assignments.length > 5 && (
                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-[#2d3548] border-2 border-white dark:border-[#1a1f2e] flex items-center justify-center">
                  <span className="text-[9px] font-bold text-gray-600 dark:text-gray-300">+{project.assignments.length - 5}</span>
                </div>
              )}
            </div>
          )}
          {!isReadOnly && (
            <button
              onClick={handleAddTag}
              className="w-6 h-6 rounded-full bg-orange-500/20 hover:bg-orange-500/30 flex items-center justify-center transition-colors border border-dashed border-orange-500/40"
              title="Add member"
            >
              <Plus className="w-3 h-3 text-orange-500" />
            </button>
          )}
        </div>
```

In the "Add Member" modal, update the user list to show "Already assigned" instead of checking labels, and add a role picker. Replace `isAlreadyMember` check:
```typescript
const isAlreadyMember = project.assignments.some(a => a.userId === user.id);
```

Add a simple role selection in the modal. When clicking a user to add, show two buttons:
```tsx
  <button onClick={() => handleAddMember(user.id, 'PRIMARY')} className="...">Primary</button>
  <button onClick={() => handleAddMember(user.id, 'COLLABORATOR')} className="...">Collaborator</button>
```

Update the import to include `assignmentAPI`:
```typescript
import { API_BASE_URL, projectAPI, assignmentAPI } from '@/lib/api-service';
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/kanban/Card.tsx
git commit -m "refactor: card uses assignments instead of labels for members, green checkmark for DONE"
```

---

## Task 13: Frontend — ProjectModal.tsx Assignments Section

**Files:**
- Modify: `frontend/components/project/ProjectModal.tsx`

- [ ] **Step 1: Replace label-based member management with assignments**

Replace `handleAddMember` to use `assignmentAPI.add` instead of `projectAPI.addLabel`. Replace `handleRemoveMember` to use `assignmentAPI.remove` instead of `projectAPI.removeLabel`.

Add a new handler for toggling assignment status:
```typescript
  const handleToggleStatus = async (assignment: ProjectAssignment) => {
    const newStatus = assignment.status === 'ACTIVE' ? 'DONE' : 'ACTIVE';
    try {
      const result = await assignmentAPI.update(project.id, assignment.id, { status: newStatus });
      if (result.success) {
        const updatedAssignments = project.assignments.map(a =>
          a.id === assignment.id
            ? { ...a, status: newStatus, completedAt: newStatus === 'DONE' ? new Date().toISOString() : null }
            : a
        );
        dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, assignments: updatedAssignments, updatedAt: new Date() } });
        toast.success(newStatus === 'DONE' ? 'Marked as done' : 'Marked as active');
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };
```

In the assignments display section, render each member with:
- Avatar + Name
- Specialization badge (if PRODUCTION)
- Primary/Collaborator label
- Active/Done toggle button (green checkmark or orange dot)
- Remove button

The toggle should be enabled for:
- The assigned user themselves
- Any user with PM or TL role

```tsx
{project.assignments.map((assignment) => (
  <div key={assignment.id} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
    <div className="flex items-center gap-2">
      <Avatar className="w-8 h-8">
        <AvatarImage src={assignment.user?.avatar || undefined} />
        <AvatarFallback>{assignment.user?.name?.[0]}</AvatarFallback>
      </Avatar>
      <div>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{assignment.user?.name}</p>
        <div className="flex items-center gap-1.5">
          {assignment.user?.specialization && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              {assignment.user.specialization.replace('_', ' ')}
            </span>
          )}
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
            {assignment.role === 'PRIMARY' ? 'Primary' : 'Collaborator'}
          </span>
        </div>
      </div>
    </div>
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleToggleStatus(assignment)}
        className={cn(
          'px-2 py-1 rounded text-xs font-medium transition-all',
          assignment.status === 'DONE'
            ? 'bg-green-500/15 text-green-600 dark:text-green-400'
            : 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
        )}
      >
        {assignment.status === 'DONE' ? '✓ Done' : '● Active'}
      </button>
      <button onClick={() => handleRemoveAssignment(assignment.id)} className="p-1 text-zinc-400 hover:text-red-500">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
))}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/project/ProjectModal.tsx
git commit -m "refactor: ProjectModal uses assignments with role/status controls"
```

---

## Task 14: Frontend — CreateProjectModal.tsx

**Files:**
- Modify: `frontend/components/project/CreateProjectModal.tsx`

- [ ] **Step 1: Update project creation flow**

The modal currently creates a project and then adds `selectedMembers` as labels in a loop. Change to:
1. Create the project (creator auto-assigned as PRIMARY by backend)
2. For each selected member, call `assignmentAPI.add` instead of `projectAPI.addLabel`
3. Remove `pm: state.currentUser.id` and `developer: null` from the local project object
4. Build `assignments` array for local state

Replace the post-creation member loop (lines 104-117):
```typescript
        // Add selected members as assignments
        const addedAssignments: any[] = [];
        for (const memberId of selectedMembers) {
          if (memberId === state.currentUser?.id) continue; // Creator already assigned by backend
          try {
            const assignResult = await assignmentAPI.add(p.id, memberId, 'PRIMARY');
            if (assignResult.success) {
              addedAssignments.push(assignResult.data.assignment);
            }
          } catch { /* continue */ }
        }
```

Replace the local project object (lines 120-150):
```typescript
        const newProject: Project = {
          id: p.id,
          name: name.trim(),
          description: description.trim(),
          boardId: p.boardId || initialBoard,
          board: p.board ? { id: p.board.id, name: p.board.name } : undefined,
          teamId: p.teamId,
          team: p.team ? { id: p.team.id, slug: p.team.slug, name: p.team.name } : undefined,
          status: p.status || status,
          priority: (p.priority || 'MEDIUM').toLowerCase() as ProjectPriority,
          dueDate: dueDate || null,
          image: imageUrl.trim() || null,
          position: 0,
          assignments: [
            // Creator's assignment (from backend response)
            ...(p.assignments || []),
            // Additional assignments we just created
            ...addedAssignments,
          ],
          clientId: (selectedClientId && selectedClientId !== 'none') ? selectedClientId : null,
          labels: [],
          checklist: [],
          comments: [],
          attachments: [],
          activityLog: [
            {
              id: Math.random().toString(36),
              userId: state.currentUser!.id,
              action: 'Created project',
              timestamp: new Date(),
            },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
```

Add import for `assignmentAPI`:
```typescript
import { API_BASE_URL, projectAPI, clientAPI, assignmentAPI } from '@/lib/api-service';
```

In the Members dropdown, remove `({user.role})` from the display:
```tsx
<SelectItem key={user.id} value={user.id}>
  {user.name}
</SelectItem>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/project/CreateProjectModal.tsx
git commit -m "refactor: CreateProjectModal uses assignments instead of labels for members"
```

---

## Task 15: Frontend — AdminEmployees Performance Modal Rewrite

**Files:**
- Modify: `frontend/components/admin/AdminEmployees.tsx`

- [ ] **Step 1: Rewrite PerformanceContent component**

Replace the entire `PerformanceContent` function with role-aware rendering based on the new `EmployeePerformance` type.

```tsx
function PerformanceContent({ employee, performance }: { employee: Employee; performance: EmployeePerformance }) {
  const isSales = performance.role === 'PM' || performance.role === 'TL';
  const isProd = performance.role === 'PRODUCTION';

  return (
    <div className="space-y-5">
      {/* Common: Assignment Stats */}
      <div className="grid grid-cols-2 gap-3">
        <PerfStat label="Active Projects" value={String(performance.activeProjects)} />
        <PerfStat label="Completed" value={String(performance.completedProjects)} />
        <PerfStat label="As Primary" value={String(performance.asPrimary)} />
        <PerfStat label="As Collaborator" value={String(performance.asCollaborator)} />
      </div>

      {/* Sales: Revenue & Invoices */}
      {isSales && (
        <>
          <SectionHeader title="Revenue" />
          <div className="grid grid-cols-2 gap-3">
            <PerfStat label="Total Revenue" value={`£${(performance.totalRevenue || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} />
            <PerfStat label="This Month" value={`£${(performance.revenueThisMonth || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} />
            <PerfStat label="Avg Invoice" value={`£${(performance.averageInvoiceValue || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} />
            <PerfStat label="Total Invoices" value={String(performance.totalInvoicesSent || 0)} />
          </div>

          {performance.invoiceBreakdown && Object.keys(performance.invoiceBreakdown).length > 0 && (
            <>
              <SectionHeader title="Invoice Breakdown" />
              <div className="space-y-1">
                {Object.entries(performance.invoiceBreakdown).map(([status, data]) => (
                  <div key={status} className="flex justify-between text-sm py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                    <span className="text-zinc-600 dark:text-zinc-400 capitalize">{status.toLowerCase()}</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {data.count} (£{data.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })})
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <SectionHeader title="Clients" />
          <div className="grid grid-cols-2 gap-3">
            <PerfStat label="Total Clients" value={String(performance.totalClients || 0)} />
            <PerfStat label="New This Month" value={String(performance.newClientsThisMonth || 0)} />
          </div>
        </>
      )}

      {/* TL: Team Section */}
      {performance.role === 'TL' && performance.team && (
        <>
          <SectionHeader title="Team Aggregate" />
          <div className="grid grid-cols-2 gap-3">
            <PerfStat label="Team Revenue" value={`£${performance.team.totalRevenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} />
            <PerfStat label="Team This Month" value={`£${performance.team.revenueThisMonth.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} />
            <PerfStat label="Team Active" value={String(performance.team.activeProjects)} />
            <PerfStat label="Team Completed" value={String(performance.team.completedProjects)} />
          </div>

          {performance.team.members.length > 0 && (
            <>
              <SectionHeader title="Team Members" />
              <div className="space-y-1">
                {performance.team.members.map((m) => (
                  <div key={m.id} className="flex justify-between items-center text-sm py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                    <div>
                      <span className="text-zinc-600 dark:text-zinc-400">{m.name}</span>
                      <span className="text-xs text-zinc-400 ml-1.5">({m.role})</span>
                    </div>
                    <div className="text-right text-xs">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">£{m.revenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                      <span className="text-zinc-400 ml-2">{m.activeProjects} active</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Production: Specialization-specific */}
      {isProd && (
        <>
          {employee.specialization && (
            <div className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              {specLabel(employee.specialization)}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {(employee.specialization === 'DEVELOPER' || employee.specialization === 'QA') && (
              <PerfStat label="Live Projects" value={String(performance.liveProjects || 0)} />
            )}
            <PerfStat label="Minor Changes" value={String(performance.totalMinorChanges || 0)} />
            <PerfStat label="Major Changes" value={String(performance.totalMajorChanges || 0)} />
            <PerfStat label="Avg Changes/Project" value={String(performance.averageChangesPerProject || 0)} />
            <PerfStat label="Completion Rate" value={`${performance.completionRatio || 0}%`} />
          </div>
        </>
      )}

      {/* Common: Projects by Board */}
      {performance.projectsByBoard.length > 0 && (
        <>
          <SectionHeader title="Projects by Board" />
          <div className="space-y-1">
            {performance.projectsByBoard.map((b) => (
              <div key={b.boardId} className="flex justify-between text-sm py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                <span className="text-zinc-600 dark:text-zinc-400">{b.boardName}</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{b.count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide pt-2">{title}</h4>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/admin/AdminEmployees.tsx
git commit -m "refactor: rewrite performance modal with role-specific KPIs"
```

---

## Task 16: Frontend — AdminOverview Assignment Stats

**Files:**
- Modify: `frontend/components/admin/AdminOverview.tsx`

- [ ] **Step 1: Update KPIData type usage**

The backend `getKPIs` endpoint needs two new fields. First update the backend `getKPIs` in `admin.controller.ts` to add:

```typescript
      // Add to the Promise.all array:
      prisma.projectAssignment.count({ where: { status: 'ACTIVE' } }),
      prisma.projectAssignment.count({ where: { status: 'DONE', completedAt: { gte: startOfMonth } } }),
```

And include in the response:
```typescript
          activeAssignments,
          completedAssignmentsThisMonth,
```

Then update the `KPIData` interface in `frontend/lib/types.ts` to add:
```typescript
  activeAssignments: number;
  completedAssignmentsThisMonth: number;
```

- [ ] **Step 2: Add two new stat cards in AdminOverview**

After the "New Clients This Month" card, add:

```tsx
        <StatCard
          label="Active Assignments"
          value={String(kpis.activeAssignments)}
          gradient="from-indigo-400 to-indigo-300"
          icon={Users}
        />
        <StatCard
          label="Completed This Month"
          value={String(kpis.completedAssignmentsThisMonth)}
          gradient="from-teal-400 to-teal-300"
          icon={CheckCircle}
        />
```

Update the grid to accommodate 8 cards:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/admin/AdminOverview.tsx frontend/lib/types.ts backend/src/controllers/admin.controller.ts
git commit -m "feat: add assignment stat cards to admin overview"
```

---

## Task 17: Frontend — usePermissions Update

**Files:**
- Modify: `frontend/hooks/usePermissions.ts`

- [ ] **Step 1: Update permissions**

Remove `canAssignDeveloper` (no longer relevant — anyone can manage assignments).

The `canCreateProject` permission should stay PM-only as before. Assignment toggling permission is handled in the API endpoint.

```typescript
    canAssignDeveloper: isPM || isTL, // REMOVE this line
```

No new permissions needed — assignment status toggling is enforced server-side.

- [ ] **Step 2: Commit**

```bash
git add frontend/hooks/usePermissions.ts
git commit -m "refactor: remove canAssignDeveloper from permissions"
```

---

## Task 18: Database Reset & Verify

- [ ] **Step 1: Reset database and run migration**

```bash
cd backend
npx prisma migrate reset --force
```

This drops the DB, re-runs all migrations, and runs the seed. If the existing migrations conflict with the schema changes (removed pmId/developerId), create a new migration:

```bash
npx prisma migrate dev --name replace_pm_developer_with_assignments
```

- [ ] **Step 2: Verify seed output**

Expected output should show:
- All users created
- Sample projects created with assignment counts
- No errors

- [ ] **Step 3: Start backend and test endpoints**

```bash
cd backend && npm run dev
```

Test with curl or API client:
1. Login as exec.tahaanwar → get token
2. `GET /api/admin/kpis` → should return all KPI data including `activeAssignments`
3. `GET /api/admin/employees` → should show employees with assignment-based stats
4. `GET /api/admin/employees/:id/performance` → should return role-specific KPIs
5. `GET /api/projects` → should return projects with `assignments` array instead of `pm`/`developer`

- [ ] **Step 4: Start frontend and verify**

```bash
cd frontend && npm run dev
```

1. Login as executive → Management tab → Overview shows 8 stat cards
2. Employees tab → click eye icon on PM → see revenue + invoices + projects
3. Click eye icon on TL → see personal + team stats
4. Click eye icon on Production member → see specialization-specific metrics
5. Go to a Kanban board → cards show member avatars with green checkmarks for DONE
6. Click a card → see assignments section with role/status controls
7. Create new project → creator auto-assigned, add members via modal

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve any issues found during integration testing"
```

---

## Execution Notes

**Task dependencies:** Tasks 1-3 must be done first (schema + validators). Tasks 4-8 are backend and can be done in sequence. Tasks 9-10 are frontend foundation. Tasks 11-16 are frontend components that depend on 9-10. Task 17 is independent. Task 18 is final verification.

**Critical path:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18

**Railway deployment note:** Since we're dropping pmId/developerId columns, the migration will fail if existing data references them. On Railway, you'll need to either:
- Reset the remote DB (`prisma migrate reset`)
- Or create a multi-step migration that first migrates data, then drops columns

Since user confirmed they're not concerned about data, a full reset is fine.
