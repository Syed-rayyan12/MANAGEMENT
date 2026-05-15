# Soft-Delete, Restore & Password-Verified Deletion

**Date:** 2026-05-15
**Status:** Approved

## Goal

Add the ability to delete boards (workspaces), columns, and projects from within the workspace UI. Deletions are soft (recoverable for 30 days) and cascade downward: deleting a board soft-deletes its columns and projects; deleting a column soft-deletes its projects. All deletions require the user to enter their password in a two-step confirmation flow.

## Decisions

| Decision | Choice |
|----------|--------|
| Soft-delete mechanism | `deletedAt` timestamp field (null = active) |
| Cascade behavior | Board → columns + projects; Column → projects |
| Retention period | 30 days, then hard-purged |
| Who can delete | PM and PRODUCTION only (not TL, not EXECUTIVE) |
| Restore destination | Back in place; slug conflict → append `-restored` |
| Restore UI | Centralized Trash page at `/dashboard/trash` |
| Confirmation flow | Two-step: warning summary modal, then password entry modal |
| Google Sheets sync | Dropped from project — ignore remnant code |

## Data Model Changes

Add to **Board**, **BoardColumn**, and **Project** models:

```prisma
deletedAt    DateTime? @map("deleted_at")
deletedById  String?   @map("deleted_by_id")
deletedBy    User?     @relation("deletedBoards", fields: [deletedById], references: [id], onDelete: SetNull)
```

Each model gets its own relation name (`deletedBoards`, `deletedColumns`, `deletedProjects`). `deletedBy` uses `SetNull` so that if the deleting user is later removed, the deleted record is still restorable.

Every existing Prisma query on these three models must add `deletedAt: null` to the `where` clause to exclude soft-deleted records.

## Backend API Endpoints

### New Endpoints

| Method | Route | Body | Purpose |
|--------|-------|------|---------|
| `POST` | `/api/auth/verify-password` | `{ password }` | Verify current user's password |
| `POST` | `/api/boards/:boardId/soft-delete` | `{}` | Soft-delete board + cascade |
| `POST` | `/api/boards/:boardId/columns/:columnId/soft-delete` | `{}` | Soft-delete column + cascade |
| `POST` | `/api/projects/:id/soft-delete` | `{}` | Soft-delete single project |
| `GET` | `/api/trash` | — | List all soft-deleted items |
| `POST` | `/api/trash/restore` | `{ type, id }` | Restore item + children |

All soft-delete and restore endpoints require `authenticate` + `authorizeRoles('PM', 'PRODUCTION')`.

The verify-password endpoint requires only `authenticate` (any role).

### Password Verification Flow

1. Frontend step 1: warning modal shows impact summary → user clicks "Continue"
2. Frontend step 2: password modal → user enters password, clicks "Delete"
3. Frontend calls `POST /api/auth/verify-password` with `{ password }`
4. If password valid (200), frontend calls the soft-delete endpoint
5. If password invalid (401), show error in the password modal

### Soft-Delete Cascade Logic

**Board soft-delete (single transaction):**
```
board.deletedAt = now()
board.deletedById = currentUserId
UPDATE all board's columns SET deletedAt = now(), deletedById = currentUserId WHERE deletedAt IS NULL
UPDATE all board's projects SET deletedAt = now(), deletedById = currentUserId WHERE deletedAt IS NULL
```

**Column soft-delete (single transaction):**
```
column.deletedAt = now()
column.deletedById = currentUserId
UPDATE all column's projects (by status = column.key AND boardId = column.boardId) SET deletedAt = now(), deletedById = currentUserId WHERE deletedAt IS NULL
```

**Project soft-delete:**
```
project.deletedAt = now()
project.deletedById = currentUserId
```

### Restore Logic

**Restore board:** Set `deletedAt = null`, `deletedById = null` on the board + all columns and projects that share the same `deletedAt` timestamp (± 1 second tolerance for transaction timing). If slug conflicts with an existing active board, append `-restored` suffix.

**Restore column:** Set `deletedAt = null`, `deletedById = null` on the column + its cascade-deleted projects (same timestamp match). The parent board must be active — if the board is also deleted, prompt to restore the board first.

**Restore project:** Set `deletedAt = null`, `deletedById = null` on the project only. Parent board and column must be active.

### Trash List Endpoint

Returns three arrays: `{ boards: [...], columns: [...], projects: [...] }`. Each item includes: `id`, `name`, `deletedAt`, `deletedBy.name`, `daysRemaining` (30 - days since deletion). Ordered by `deletedAt` descending (most recent first).

### Auto-Purge

A `purgeExpiredTrash()` utility function that hard-deletes records where `deletedAt < now() - 30 days`. Called on app startup. Uses Prisma transactions and deletes in order: projects first, then columns, then boards (to respect foreign keys).

## Existing Query Changes

All queries on Board, BoardColumn, and Project need `deletedAt: null` in their where clause:

- `board.controller.ts`: `getAllBoards`, `getBoardBySlug`, `addBoardColumn`, `getAllBoardColumns`
- `project.controller.ts`: `getProjects`, `getProjectById`, `updateProject`, `getProjectStats`, and sub-resource queries (assignments, comments, checklists) that join to projects
- `dashboard.controller.ts`: dashboard stats/counts queries

The existing `deleteProject` hard-delete endpoint (`DELETE /api/projects/:id`) is replaced by the new soft-delete endpoint. The old endpoint and its route are removed.

## Frontend UI

### Delete Buttons (Workspace Page)

- **Column header:** Three-dot dropdown menu with "Delete Column" option
- **Board/workspace level:** Settings dropdown or trash icon in the page header with "Delete Workspace" option

### Two-Step Deletion Modal

**Step 1 — Warning Modal:**
- Title: "Delete [Board Name / Column Name / Project Name]?"
- Impact summary showing cascade counts (e.g., "This will delete **Logo Design** along with **3 columns** and **47 projects**")
- Note: "Items can be restored from Trash within 30 days."
- Buttons: "Cancel" (neutral) and "Continue" (red/destructive)

**Step 2 — Password Modal:**
- Title: "Enter your password to confirm"
- Password input field with eye toggle
- Error message area for wrong password
- Buttons: "Back" (returns to step 1) and "Delete" (red, triggers verify + soft-delete)

### Trash Page (`/dashboard/trash`)

- New route in the dashboard
- Sidebar nav item: "Trash" with trash can icon
- Grouped sections or tabs: Boards, Columns, Projects
- Each item shows: name, deleted by (username), time since deletion, days remaining
- "Restore" button per item
- Success toast on restore
- Empty state: "Trash is empty"
- Only visible to PM and PRODUCTION roles

### Sidebar Navigation

Add "Trash" link to the sidebar navigation component, positioned below existing nav items. Uses a trash can icon. Optionally shows a badge with count of items in trash.
