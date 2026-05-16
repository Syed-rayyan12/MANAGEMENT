# Production Performance & Privileges Redesign

## Problem

PRODUCTION users' performance metrics are broken:
- Metrics are controlled by other people's actions (PMs recording changes)
- `minorChanges`/`majorChanges` are attributed to projects, not individuals
- No time-based tracking (turnaround, deadlines)
- PRODUCTION users lack privileges to manage their own workflow

PMs are salespeople in this business — they don't manage production and shouldn't be responsible for recording production quality signals.

## Solution

1. Elevate PRODUCTION privileges to PM/TL level (except invoices)
2. Replace manual change tracking with auto-detected column regressions
3. Add due dates for on-time delivery tracking
4. Build a self-service performance dashboard for PRODUCTION users

---

## Data Model Changes

### Add to Project

```prisma
dueDate DateTime? @map("due_date")
```

### Remove from Project

- `minorChanges` — replaced by regression tracking
- `majorChanges` — replaced by regression tracking
- `majorChangeReason` — context lives in comments

### New Model: Regression

```prisma
model Regression {
  id         String   @id @default(uuid())
  projectId  String
  project    Project  @relation(fields: [projectId], references: [id])
  userId     String   // production user whose work was regressed
  user       User     @relation("regressionTarget", fields: [userId], references: [id])
  causedById String   // who moved it backward
  causedBy   User     @relation("regressionCauser", fields: [causedById], references: [id])
  fromColumn String   // column key it was in
  toColumn   String   // column key it moved back to
  createdAt  DateTime @default(now())

  @@map("regressions")
}
```

---

## Regression Detection Logic

When a project's status changes:

1. Look up column positions: `BoardColumn.position` for old and new status
2. If new position < old position (backward move):
   - Identify who triggered the move
   - If the mover is NOT one of the project's assigned production users:
     - Create a `Regression` record for the **PRIMARY** assignee(s) with role PRODUCTION
   - If the mover IS the assigned production user: no regression (self-correction)
3. Only PRIMARY assignment holders receive regressions, not COLLABORATORS

---

## Performance Metrics (PRODUCTION)

The `getEmployeePerformance` endpoint returns for PRODUCTION users:

| Metric | Calculation |
|--------|-------------|
| Completed Projects | Assignments with status DONE |
| Active Projects | Assignments with status ACTIVE |
| On-Time Rate (%) | Completed projects where `completedAt <= project.dueDate` / total completed with dueDate |
| Late Deliveries | Count where `completedAt > dueDate` |
| Avg Turnaround (days) | Average of `completedAt - assignedAt` across DONE assignments |
| Fastest / Slowest | Min and max turnaround times |
| Regressions (total) | Count from Regression table |
| Regressions (this month) | Filtered by `createdAt >= startOfMonth` |
| Regression Rate | Regressions / total assigned projects |
| Projects by Board | Distribution across boards |
| Completion Trend | Completed grouped by month (last 6 months) |

---

## Production Privileges Elevation

PRODUCTION users gain:

| Action | Before | After |
|--------|--------|-------|
| Create projects | No | Yes |
| Edit project details | Only if assigned | Yes (any visible project) |
| Drag projects across columns | No | Yes |
| Set/update due date | No | Yes |
| Mark own assignment DONE | Yes | Yes |
| Manage checklists | Limited | Full |
| Create invoices | No | Still no (PM/TL/exec only) |

Implementation: update `authorizeRoles()` middleware to include `'PRODUCTION'` on project CRUD, status change, and due date endpoints.

---

## Production Performance Dashboard

New page: `/dashboard/my-performance` (PRODUCTION role only)

### Top Stats Row
- On-Time Rate (%) — green/yellow/red coloring
- Avg Turnaround — in days
- Regressions This Month — count
- Active / Completed ratio

### Sections Below
- **Completion Trend** — bar chart, last 6 months
- **Recent Completions** — table: project name, board, turnaround days, on-time status
- **Regressions List** — table: project name, caused by, date, from→to columns

### Executive View

The existing admin employee performance page displays these same metrics when viewing a PRODUCTION user. Replaces the old minorChanges/majorChanges display.

---

## What Gets Removed

- `Project.minorChanges` field and column
- `Project.majorChanges` field and column
- `Project.majorChangeReason` field and column
- "Record Change" dropdown in ProjectModal
- Google Sheets sync for change tracking (already dropped per prior decision)
- Old PRODUCTION performance section in admin controller (replaced with new metrics)

---

## Who Controls What

| Metric | Controlled By |
|--------|---------------|
| Completion | Production user marks own assignment DONE |
| Turnaround time | Production user (faster completion = better score) |
| On-time delivery | Production user (complete before dueDate) |
| Regressions | Triggered by PM/TL/exec moving project backward — reflects quality of work delivered |
| Due date | Set by PM (from client) or production user (self-imposed) |

Every metric is either self-driven by the production user or an objective system observation. No manual logging by PMs required.
