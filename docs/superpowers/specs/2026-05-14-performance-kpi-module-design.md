# Performance & KPI Module — Design Spec

## Overview

Replace the disconnected label-based member system and single `developerId`/`pmId` fields with a proper `ProjectAssignment` table. All users (PM, TL, Production, Executive) join cards through the same assignment system. Each assignment tracks role (Primary/Collaborator), completion status (Active/Done), and feeds into role-specific performance KPIs visible through the admin dashboard's employee performance modal.

## Goals

1. Every person working on a project is a `ProjectAssignment` — no more label hacks or single-user fields
2. Each member can independently mark their work as Done, regardless of card column position
3. Performance modals show meaningful, role-specific KPIs for Sales (PM/TL) and Production (all specializations)
4. Keep the Trello-style simplicity — no ticketing, no sub-tasks, no time tracking

## Non-Goals

- Revenue splitting or shared attribution (invoice revenue stays with `createdById`)
- Per-member change tracking (changes remain project-level, attributed to all assigned production members)
- Converting the PM module into a ticketing system
- Data migration from existing projects (re-seed instead)

---

## 1. Data Model Changes

### 1.1 New Enums

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

### 1.2 New Model: ProjectAssignment

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
  @@map("project_assignments")
}
```

### 1.3 Fields Removed from Project

- `pmId` — removed
- `pm` relation — removed
- `developerId` — removed
- `developer` relation — removed

### 1.4 Relations Added

- `Project.assignments ProjectAssignment[]`
- `User.assignments ProjectAssignment[]`

### 1.5 Unchanged

- `Project.labels` / `ProjectLabel` / `Label` — reverts to being pure tags (color-coded labels), no longer used for member tracking
- `User.specialization` — stays on User, never duplicated onto assignments
- `Invoice` model — completely untouched
- `minorChanges` / `majorChanges` — stay project-level

---

## 2. Assignment System

### 2.1 How Members Are Assigned

Any authenticated user can assign any user to any card they can see. Production members can self-assign.

**Flow:**
1. Click "+" button on card (or inside card modal)
2. Search/select a user from the member list
3. Pick role: **Primary** (default) or **Collaborator**
4. Assignment created

### 2.2 Marking Work as Done

Inside the card modal, each assignment shows a toggle:
- **Active** (orange dot) — default state
- **Done** (green checkmark) — member's work on this project is complete

**Who can toggle:**
- Any member can mark their OWN assignment as Done
- PM and TL can mark ANYONE's assignment as Done

When status changes to DONE, `completedAt` is set to current timestamp. When changed back to ACTIVE, `completedAt` is cleared.

### 2.3 Card UI (Kanban)

- Stacked avatars on the card, same as current design
- Members with status = DONE show a small green checkmark overlay on their avatar
- "Add Member" button remains the same orange "+" circle
- All detail (specialization, role, status toggle) lives inside the card modal

### 2.4 Card Modal (ProjectModal)

**Assignments section replaces the current labels-as-members section:**
- List of assigned members, each showing:
  - Avatar + Name
  - Specialization tag (if production)
  - Primary/Collaborator label
  - Active/Done toggle button
- "Add Member" button at bottom
- Remove member via X button

### 2.5 API Endpoints

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `POST` | `/api/projects/:id/assignments` | `{ userId, role? }` | Add member to project |
| `PUT` | `/api/projects/:id/assignments/:assignmentId` | `{ role?, status? }` | Update role or status |
| `DELETE` | `/api/projects/:id/assignments/:assignmentId` | — | Remove member |

All endpoints require authentication. Permission rules:
- **POST (add member):** Any authenticated user
- **PUT (update role):** Any authenticated user
- **PUT (update status to DONE/ACTIVE):** The assigned user themselves, OR any user with role PM or TL
- **DELETE (remove member):** Any authenticated user

When status is updated to `DONE`, the backend sets `completedAt = new Date()`. When updated back to `ACTIVE`, the backend sets `completedAt = null`.

### 2.6 Project Creation

When a project is created, the creating user is automatically added as the first `ProjectAssignment` with `role = PRIMARY`. The create project form includes a PM picker — the selected PM becomes this first assignment. Additional members are added after creation via the card modal.

---

## 3. Performance Modal — Sales (PM)

Displayed when clicking the eye icon on a PM in the admin employees list.

### 3.1 Revenue Section

| Metric | Query |
|--------|-------|
| Total revenue (all-time) | `SUM(amount)` from PAID invoices where `createdById = userId` |
| Revenue this month | Same, filtered `paidAt >= startOfMonth` |
| Average invoice value | `AVG(amount)` from PAID invoices where `createdById = userId` |

### 3.2 Invoice Breakdown

| Metric | Query |
|--------|-------|
| Total invoices sent | `COUNT(*)` where `createdById = userId` |
| Pending | `COUNT(*)` where status = PENDING + `SUM(amount)` |
| Paid | `COUNT(*)` where status = PAID + `SUM(amount)` |
| Cancelled / Failed | `COUNT(*)` where status IN (CANCELLED, FAILED) |

### 3.3 Projects Section

| Metric | Source |
|--------|--------|
| Active projects | Assignments where `userId = PM` AND `status = ACTIVE` |
| Completed projects | Assignments where `userId = PM` AND `status = DONE` |
| Projects as Primary | Assignments where `role = PRIMARY` |
| Projects as Collaborator | Assignments where `role = COLLABORATOR` |
| Projects by board | Group assignments by `project.boardId` |

### 3.4 Clients Section

| Metric | Query |
|--------|-------|
| Total distinct clients | `COUNT(DISTINCT clientName)` from invoices where `createdById = userId` |
| New clients this month | Distinct `clientName` from invoices where `createdById = userId` AND `createdAt >= startOfMonth` that don't appear in earlier invoices |

---

## 4. Performance Modal — Sales (TL)

### 4.1 Personal Stats

Identical to PM performance (Section 3) — TL's own revenue, invoices, projects, clients.

### 4.2 Team Aggregate Section

All metrics below are scoped to invoices/assignments where the user belongs to one of the TL's teams (via `TeamMember`).

| Metric | Query |
|--------|-------|
| Team total revenue (all-time) | `SUM(amount)` PAID invoices where `teamId IN (TL's teamIds)` |
| Team revenue this month | Same, filtered by `paidAt >= startOfMonth` |
| Team invoices: pending/paid/cancelled | Counts by status where `teamId IN (TL's teamIds)` |
| Team active projects | Count of ACTIVE assignments for team members |
| Team completed projects | Count of DONE assignments for team members |

### 4.3 Team Member Rows

For each member in the TL's team(s):

| Column | Source |
|--------|--------|
| Name + Role | From User |
| Revenue generated | SUM of their PAID invoices |
| Active projects | Their ACTIVE assignment count |

---

## 5. Performance Modal — Production

### 5.1 Common Stats (All Specializations)

| Metric | Source |
|--------|--------|
| Specialization | Badge from `User.specialization` |
| Active projects | Assignments where `status = ACTIVE` |
| Completed projects | Assignments where `status = DONE` |
| As Primary | Assignments where `role = PRIMARY` |
| As Collaborator | Assignments where `role = COLLABORATOR` |
| Projects by board | Group assignments by `project.boardId` |

### 5.2 Developer

| Metric | Source |
|--------|--------|
| Live projects | Assignments on projects where `status = 'live'` (web dev board) |
| Total minor changes | `SUM(project.minorChanges)` across assigned projects |
| Total major changes | `SUM(project.majorChanges)` across assigned projects |
| Average changes per project | Total changes / assigned project count |

### 5.3 Figma Designer

| Metric | Source |
|--------|--------|
| Total minor changes | `SUM(project.minorChanges)` across assigned projects |
| Total major changes | `SUM(project.majorChanges)` across assigned projects |
| Projects by board | Board breakdown of their assignments |

### 5.4 Logo Designer

| Metric | Source |
|--------|--------|
| Total minor changes | `SUM(project.minorChanges)` across assigned projects |
| Total major changes | `SUM(project.majorChanges)` across assigned projects |
| Completion ratio | DONE assignments / total assignments |

### 5.5 Content Writer

| Metric | Source |
|--------|--------|
| Total minor changes | `SUM(project.minorChanges)` across assigned projects |
| Total major changes | `SUM(project.majorChanges)` across assigned projects |
| Projects by board | Board breakdown |

### 5.6 QA

| Metric | Source |
|--------|--------|
| Live projects | Assignments on projects where `status = 'live'` |
| Total minor changes | `SUM(project.minorChanges)` across assigned projects |
| Total major changes | `SUM(project.majorChanges)` across assigned projects |
| Completed projects | Emphasised — QA done = project ready for launch |

### 5.7 Changes Attribution Note

`minorChanges` and `majorChanges` are project-level fields. When a project has multiple production members, the change counts are attributed to ALL of them. This is a known approximation. Per-member change tracking is a future enhancement that would require modifying how changes are recorded across the entire PM module.

---

## 6. Admin Overview KPIs

The AdminOverview page stat cards remain the same:

| Card | Source |
|------|--------|
| Total Revenue / This Month | Invoice aggregation (unchanged) |
| Active / Completed / Live Projects | Project status counts (unchanged) |
| New Clients This Month | Client count (unchanged) |
| Projects by Board | Board aggregation (unchanged) |
| Revenue by Team | Invoice-by-team aggregation (unchanged) |

**New addition:**

| Card | Source |
|------|--------|
| Active Assignments | Count of all ACTIVE ProjectAssignments |
| Completed This Month | DONE assignments where `completedAt >= startOfMonth` |

---

## 7. Affected Code

### 7.1 Backend — Schema & Migration

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `AssignmentRole`, `AssignmentStatus` enums, `ProjectAssignment` model. Remove `pmId`, `developerId`, `pm`, `developer` from Project. Add `assignments` relation to Project and User. |
| `prisma/seed.ts` | Update to create `ProjectAssignment` records instead of setting `pmId`/`developerId`. Clean up label-as-member seeds if any. |

### 7.2 Backend — Controllers

| File | Change |
|------|--------|
| `controllers/project.controller.ts` | Replace `pmId`/`developerId` logic with assignments. Update `projectIncludes` to include `assignments` with user data. `createProject` creates an assignment instead of setting `pmId`. Update all queries. |
| `controllers/admin.controller.ts` | `getEmployees` — stats from assignments instead of pmId/developerId groupBy. `getEmployeePerformance` — complete rewrite for new KPI structure (Sections 3-5). `createEmployee` / `deleteEmployee` — remove pmId/developerId references. |
| `controllers/dashboard.controller.ts` | Replace `pmId`/`developerId` references with assignment queries for my-stats. |
| `controllers/notification.controller.ts` | Update if it references pmId/developerId. |
| New: `controllers/assignment.controller.ts` | Handlers for POST/PUT/DELETE assignment endpoints. |

### 7.3 Backend — Routes

| File | Change |
|------|--------|
| `routes/project.routes.ts` | Add assignment sub-routes or create new `assignment.routes.ts`. |
| New: `routes/assignment.routes.ts` | `/api/projects/:id/assignments` — POST, PUT, DELETE. |

### 7.4 Backend — Validators

| File | Change |
|------|--------|
| `utils/validators.ts` | Add `createAssignmentSchema` (`userId`, `role`), `updateAssignmentSchema` (`role?`, `status?`). Remove `developerId` from project schemas. Remove `pmId` from create project schema, add required first-assignment PM user. |

### 7.5 Frontend — Types

| File | Change |
|------|--------|
| `lib/types.ts` | Add `AssignmentRole`, `AssignmentStatus`, `ProjectAssignment` types. Update `Project` to have `assignments: ProjectAssignment[]` instead of `pm`, `developer`, `pmId`, `developerId`. Update performance types for new KPI structure. |

### 7.6 Frontend — API

| File | Change |
|------|--------|
| `lib/api-service.ts` | Add `assignmentAPI`: `create`, `update`, `remove`. Update `adminAPI.getEmployeePerformance` response types. |

### 7.7 Frontend — Components

| File | Change |
|------|--------|
| `components/kanban/Card.tsx` | Read members from `project.assignments` instead of `project.labels`. Green checkmark overlay on DONE avatars. "Add Member" creates assignment via `assignmentAPI`. Remove label-based member logic. |
| `components/project/ProjectModal.tsx` | Assignments section: list members with specialization tag, Primary/Collaborator label, Active/Done toggle. Add/remove member controls. |
| `components/project/CreateProjectModal.tsx` | PM selection becomes first assignment (role: PRIMARY). Remove `pmId` field, add PM user picker that creates assignment on project creation. |
| `components/admin/AdminEmployees.tsx` | `PerformanceContent` — complete rewrite for new KPI structure per Sections 3-5. PM view: revenue + invoices + projects + clients. TL view: personal + team aggregate. Production view: specialization-specific metrics. |
| `components/admin/AdminOverview.tsx` | Add Active Assignments and Completed This Month stat cards. |
| `contexts/AppContext.tsx` | `mapApiProject` — map `assignments` instead of `pm`/`developer`. |

### 7.8 Frontend — Hooks & Permissions

| File | Change |
|------|--------|
| `hooks/usePermissions.ts` | May need `canToggleAssignment` — own assignment always, PM/TL can toggle others. |

---

## 8. Seed Data Updates

| Change | Detail |
|--------|--------|
| Project creation in seed | Create `ProjectAssignment` records instead of setting `pmId`/`developerId` |
| Production assignments | Assign production users to projects with appropriate specialization-based distribution |
| Role distribution | Mix of PRIMARY and COLLABORATOR assignments for realistic KPI data |
| Status distribution | Some assignments marked DONE with `completedAt` set for completed projects |
