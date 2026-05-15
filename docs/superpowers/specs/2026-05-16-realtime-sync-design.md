# Real-Time Sync — Design Spec

## Goal

Add real-time cross-user synchronization to the Kanban board so that when any user creates, moves, updates, or deletes a project card, all other users viewing the same board see the change instantly. Upgrade notifications from 30-second polling to instant push.

## Context

- 10-15 power users (office CRM), 9+ hours daily on Railway paid plan
- Existing stack: Express backend, Next.js 16 frontend, @dnd-kit Kanban, AppContext state management
- Board.tsx already has optimistic UI with 1.5s debounced saves and error reversion
- No WebSocket infrastructure exists yet

## Approach

Socket.io on the existing Express server. No new Railway service, no Redis. Single-instance Socket.io handles 10-15 users trivially. Rooms scope events per board. JWT auth on handshake. Conflict detection via `updatedAt` timestamps.

---

## Backend: Socket.io Server

### Setup

Socket.io attaches to the existing HTTP server in `server.ts`. Same domain, same port — Railway routes WebSocket upgrade requests automatically.

### Authentication

On connection, the client sends its JWT in the `auth` handshake. Socket middleware verifies it using the existing `JWT_SECRET`. Invalid token rejects the connection. Valid token attaches `socket.data.user` with `{ id, name, role, teamId }`.

### Rooms

- **Board rooms** (`board:{boardSlug}`): Clients join when navigating to a board, leave when navigating away or disconnecting.
- **User rooms** (`user:{userId}`): Clients auto-join their personal room on connection. Used for notification push.

### Events Emitted by Server

| Event | Room | Payload | Triggered by |
|-------|------|---------|-------------|
| `project:created` | `board:{slug}` | Full project card data | `createProject`, `restoreProject` |
| `project:updated` | `board:{slug}` | Full updated project card data + `actorName` | `updateProject`, `addComment`, `addAttachment`, `updateChecklist` |
| `project:deleted` | `board:{slug}` | `{ projectId, actorName }` | `deleteProject` (soft-delete) |
| `notification:new` | `user:{userId}` | Notification object | Any notification creation |

All broadcasts exclude the socket that triggered the change (the actor already has the optimistic update).

### Emit Helper

A thin `emitBoardEvent(boardSlug, eventName, data, excludeSocketId?)` function. Controllers call it after successful mutations — fire-and-forget, does not block the HTTP response.

The Socket.io `io` instance is stored in a module-level variable in `socket/index.ts` and exported via getter (`getIO()`). Controllers import `getIO()` to broadcast. This avoids passing the `io` instance through Express middleware or request objects.

---

## Backend: Controller Changes

### Conflict Detection in `updateProject`

The controller checks `req.body.lastUpdatedAt` against the database record's `updatedAt`:
- **Match**: Proceed with update normally.
- **Mismatch**: Return `409 Conflict` with `{ conflict: true, updatedBy: actorName, current: projectData }`. The frontend reverts the optimistic update and shows a toast.

Only `updateProject` needs conflict detection. Other mutations (comments, attachments, checklist items) append data rather than overwrite, so concurrent appends don't conflict.

### Controllers That Broadcast

- `createProject` — emits `project:created`
- `updateProject` — emits `project:updated`
- `deleteProject` — emits `project:deleted`
- `restoreProject` — emits `project:created` (card reappears)
- `addComment` — emits `project:updated`
- `addAttachment` — emits `project:updated`
- `updateChecklist` — emits `project:updated`

### Notification Push

The existing `createManyNotifications` helper pushes each notification via socket to `user:{recipientId}` after DB insert. The 30-second polling interval on the frontend is removed.

---

## Frontend: Socket Provider

### SocketContext

A new `SocketContext` provides a single socket.io connection to the app.

- **Connect**: When `currentUser` is set in AppContext (login or page load). Passes JWT from localStorage in the `auth` handshake.
- **Auto-reconnect**: Handled by socket.io (exponential backoff, built-in).
- **Disconnect**: On logout or when `currentUser` becomes null.
- **Hook**: `useSocket()` returns the socket instance (or null if not connected).

### Wrapping

`SocketProvider` wraps the app inside the existing `AppProvider`, so it can access `dispatch` from AppContext.

---

## Frontend: Board Room Management

The board page (`[workspace]/page.tsx`) manages room membership:

- **Mount**: `socket.emit('join:board', boardSlug)`
- **Unmount**: `socket.emit('leave:board', boardSlug)`
- **Navigation between boards**: Leave old room, join new room.

Only users viewing a board receive that board's events.

---

## Frontend: Incoming Event Handling

### Project Events (Board.tsx)

Listeners registered when the board page mounts:

- `project:created` → dispatch `CREATE_PROJECT` with `mapApiProject(data)`. New card appears on the board.
- `project:updated` → dispatch `UPDATE_PROJECT` with `mapApiProject(data)`. Card updates in place. If the user has a pending (unsaved) drag for the same project, cancel the pending save and show toast: "[actorName] moved this card."
- `project:deleted` → dispatch `DELETE_PROJECT`. Card disappears.

### Notification Events (SocketContext level)

Listener registered on connection (global, not board-scoped):

- `notification:new` → dispatch `ADD_NOTIFICATION`. Badge count updates instantly.

### Conflict Handling on Drag

The existing 1.5s debounced save in Board.tsx adds `lastUpdatedAt` to the PUT body. On 409 response:
1. Revert the optimistic drag (existing revert logic).
2. Apply the server's `current` project state via `UPDATE_PROJECT`.
3. Show toast: "Card was already moved by [name]."

---

## What Stays Unchanged

- @dnd-kit library and DnD setup
- Optimistic UI pattern (immediate state update on drag)
- 1.5s debounce on saves
- Error reversion logic
- `sendBeacon` on page unload for pending saves
- AppContext reducer actions (reuse existing `CREATE_PROJECT`, `UPDATE_PROJECT`, `DELETE_PROJECT`)
- API service layer and all REST endpoints
- All existing routes

## What Changes

| File | Change |
|------|--------|
| `backend/package.json` | Add `socket.io@^4.7.x` |
| `frontend/package.json` | Add `socket.io-client@^4.7.x` |
| `backend/src/server.ts` | Attach Socket.io to HTTP server |
| `backend/src/socket/index.ts` (new) | Socket server setup, auth middleware, room handlers |
| `backend/src/socket/emitHelper.ts` (new) | `emitBoardEvent` and `emitToUser` helpers |
| `backend/src/controllers/project.controller.ts` | Add `emitBoardEvent` calls after mutations, conflict check in `updateProject` |
| `backend/src/controllers/notification.controller.ts` | Push notifications via socket after DB insert |
| `frontend/contexts/SocketContext.tsx` (new) | Socket provider, `useSocket()` hook |
| `frontend/app/dashboard/[workspace]/page.tsx` | Join/leave board room on mount/unmount |
| `frontend/components/kanban/Board.tsx` | Listen for socket events, handle conflict toast, add `lastUpdatedAt` to saves |
| `frontend/contexts/AppContext.tsx` | Remove 30s notification polling interval |

## New Dependencies

- Backend: `socket.io@^4.7.x`
- Frontend: `socket.io-client@^4.7.x`

## Out of Scope

- Presence awareness (who's viewing a board) — can be added later on the same socket infrastructure
- Cursor/selection tracking
- Offline support / queue
- Redis adapter for multi-instance scaling — not needed for 10-15 users
