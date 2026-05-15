# Real-Time Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time cross-user sync to Kanban boards via Socket.io, with conflict detection and instant notification push — replacing 30s polling.

**Architecture:** Socket.io attaches to the existing Express HTTP server (no new service). Backend broadcasts project events to board-scoped rooms after each mutation. Frontend listens via a SocketContext provider and dispatches to AppContext. Conflict detection via `updatedAt` timestamps on `updateProject`.

**Tech Stack:** Socket.io 4.7 (server + client), Express, Prisma, Next.js 16, AppContext (useReducer)

---

### Task 1: Install dependencies

**Files:**
- Modify: `backend/package.json`
- Modify: `frontend/package.json`

- [ ] **Step 1: Install socket.io on backend**

```bash
cd backend && npm install socket.io@^4.8.1
```

This installs both `socket.io` and its TypeScript types (bundled since v4).

- [ ] **Step 2: Install socket.io-client on frontend**

```bash
cd frontend && npm install socket.io-client@^4.8.1
```

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json frontend/package.json frontend/package-lock.json
git commit -m "chore: add socket.io and socket.io-client dependencies"
```

---

### Task 2: Create Socket.io server with JWT auth and room management

**Files:**
- Create: `backend/src/socket/index.ts`
- Create: `backend/src/socket/emitHelper.ts`
- Modify: `backend/src/server.ts`

This task sets up the Socket.io server, authenticates connections via JWT, and manages board/user rooms.

- [ ] **Step 1: Create `backend/src/socket/index.ts`**

```typescript
import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';

let io: Server | null = null;

export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized — call initSocket first');
  return io;
}

export function initSocket(httpServer: HttpServer, allowedOrigins: string[]) {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  // ─── JWT authentication middleware ─────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const user = verifyToken(token);
      socket.data.user = user; // { id, email, role, teamIds }
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // ─── Connection handler ────────────────────────────
  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    console.log(`[Socket] ${user.email} connected (${socket.id})`);

    // Auto-join personal room for notifications
    socket.join(`user:${user.id}`);

    // Board room management
    socket.on('join:board', (boardSlug: string) => {
      if (typeof boardSlug !== 'string' || !boardSlug) return;
      socket.join(`board:${boardSlug}`);
    });

    socket.on('leave:board', (boardSlug: string) => {
      if (typeof boardSlug !== 'string' || !boardSlug) return;
      socket.leave(`board:${boardSlug}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] ${user.email} disconnected (${socket.id})`);
    });
  });

  console.log('✅ Socket.io initialized');
  return io;
}
```

- [ ] **Step 2: Create `backend/src/socket/emitHelper.ts`**

```typescript
import { getIO } from './index';

/**
 * Broadcast a project event to everyone in a board room.
 * @param boardSlug  – the board's slug (used as room name)
 * @param event      – event name, e.g. 'project:created'
 * @param data       – payload to send
 * @param excludeSocketId – optional socket ID to exclude (the actor)
 */
export function emitBoardEvent(
  boardSlug: string,
  event: string,
  data: unknown,
  excludeSocketId?: string,
) {
  try {
    const io = getIO();
    const room = `board:${boardSlug}`;
    if (excludeSocketId) {
      io.to(room).except(excludeSocketId).emit(event, data);
    } else {
      io.to(room).emit(event, data);
    }
  } catch (error) {
    // Socket not initialized yet (e.g., during tests) — silently skip
    console.error('[Socket] emitBoardEvent failed:', error);
  }
}

/**
 * Push a notification to a specific user's personal room.
 */
export function emitToUser(userId: string, event: string, data: unknown) {
  try {
    const io = getIO();
    io.to(`user:${userId}`).emit(event, data);
  } catch (error) {
    console.error('[Socket] emitToUser failed:', error);
  }
}
```

- [ ] **Step 3: Modify `backend/src/server.ts` to attach Socket.io**

Current `server.ts` creates the HTTP server via `app.listen()` on line 26. Change it to create the HTTP server explicitly so Socket.io can attach to it.

Replace the entire `startServer` function (lines 22-61) with:

```typescript
async function startServer() {
  try {
    await connectDatabase();

    // Create HTTP server explicitly (Socket.io needs the raw server)
    const { createServer } = await import('http');
    const httpServer = createServer(app);

    // Initialize Socket.io
    const allowedOrigins = [
      process.env.CLIENT_URL || 'http://localhost:3000',
      'http://localhost:3000',
      'http://localhost:3001',
    ].filter(Boolean) as string[];

    const { initSocket } = await import('./socket/index');
    initSocket(httpServer, allowedOrigins);

    httpServer.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════╗
║   🚀 ProManage Backend Server Running    ║
╠═══════════════════════════════════════════╣
║   Environment: ${process.env.NODE_ENV || 'development'}
║   Port: ${PORT}
║   API: http://localhost:${PORT}
║   Health: http://localhost:${PORT}/health
║   WebSocket: Enabled ✅
╚═══════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
      console.log(`\n🔴 ${signal} received. Shutting down gracefully...`);
      httpServer.close(async () => {
        await prisma.$disconnect();
        console.log('Database disconnected. Process exiting.');
        process.exit(0);
      });

      // Force exit after 10s if graceful shutdown hangs
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}
```

Key change: `app.listen(PORT)` → `createServer(app)` + `httpServer.listen(PORT)`. This gives Socket.io the raw `http.Server` to attach to.

- [ ] **Step 4: Build backend to verify**

```bash
cd backend && npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/socket/index.ts backend/src/socket/emitHelper.ts backend/src/server.ts
git commit -m "feat: add Socket.io server with JWT auth and room management"
```

---

### Task 3: Add socket broadcasts to project controllers

**Files:**
- Modify: `backend/src/controllers/project.controller.ts`

Add `emitBoardEvent` calls after every project mutation. The socket broadcast is fire-and-forget — it runs after the HTTP response is sent.

**Context needed:** The `emitBoardEvent` function (from Task 2) takes `(boardSlug, event, data, excludeSocketId?)`. We need the board slug for each mutation. Most controllers already have the project with `board: { slug }` included. For the socket ID, we pass it from the request header `x-socket-id` (the frontend will set this in Task 6).

- [ ] **Step 1: Add socket imports and helper at top of file**

At the top of `backend/src/controllers/project.controller.ts`, after the existing imports (line 13), add:

```typescript
import { emitBoardEvent } from '../socket/emitHelper';
```

- [ ] **Step 2: Add broadcast to `createProject`**

In `createProject`, after the response is sent (after line 250 `res.status(201).json(...)`) but before the closing `catch`, add:

```typescript
    // ── Real-time broadcast ──────────────────────────
    if (fullProject?.board?.slug) {
      emitBoardEvent(
        fullProject.board.slug,
        'project:created',
        fullProject,
        req.headers['x-socket-id'] as string | undefined,
      );
    }
```

- [ ] **Step 3: Add conflict detection and broadcast to `updateProject`**

In `updateProject`, there are two changes:

**A) Conflict detection.** After fetching `existing` (line 285-289), before the status validation, add conflict check:

```typescript
    // ── Conflict detection (optimistic concurrency) ──
    if (updateData.lastUpdatedAt) {
      const clientUpdatedAt = new Date(updateData.lastUpdatedAt).getTime();
      const serverUpdatedAt = existing.updatedAt.getTime();
      if (clientUpdatedAt !== serverUpdatedAt) {
        // Someone else modified this project since the client last fetched it
        const currentProject = await prisma.project.findUnique({
          where: { id },
          include: projectCardIncludes,
        });
        const lastEditor = await prisma.activityLog.findFirst({
          where: { projectId: id },
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true } } },
        });
        res.status(409).json({
          success: false,
          conflict: true,
          message: 'Project was modified by another user',
          updatedBy: lastEditor?.user?.name || 'someone',
          current: currentProject,
        });
        return;
      }
      // Remove lastUpdatedAt from updateData — it's not a DB field
      delete updateData.lastUpdatedAt;
    }
```

**B) Broadcast.** After the response is sent (after line 455 `res.status(200).json(...)`) but before the closing `catch`, add:

```typescript
    // ── Real-time broadcast ──────────────────────────
    if (project.board?.slug) {
      emitBoardEvent(
        project.board.slug,
        'project:updated',
        project,
        req.headers['x-socket-id'] as string | undefined,
      );
    }
```

- [ ] **Step 4: Add broadcast to `deleteProject`**

In `deleteProject`, after the response is sent (after line 508 `res.status(200).json(...)`) but before the closing `catch`, add:

```typescript
    // ── Real-time broadcast ──────────────────────────
    // Need the board slug — fetch from the existing project (captured earlier)
    const boardForBroadcast = await prisma.board.findUnique({
      where: { id: existing.boardId },
      select: { slug: true },
    });
    if (boardForBroadcast?.slug) {
      emitBoardEvent(
        boardForBroadcast.slug,
        'project:deleted',
        { projectId: existing.id },
        req.headers['x-socket-id'] as string | undefined,
      );
    }
```

- [ ] **Step 5: Add broadcast to `addComment`**

In `addComment`, after the response is sent (after line 574 `res.status(201).json(...)`) but before the closing `catch`, add:

```typescript
    // ── Real-time broadcast ──────────────────────────
    const boardForComment = await prisma.board.findUnique({
      where: { id: project.boardId },
      select: { slug: true },
    });
    if (boardForComment?.slug) {
      const updatedProject = await prisma.project.findUnique({
        where: { id },
        include: projectCardIncludes,
      });
      if (updatedProject) {
        emitBoardEvent(
          boardForComment.slug,
          'project:updated',
          updatedProject,
          req.headers['x-socket-id'] as string | undefined,
        );
      }
    }
```

- [ ] **Step 6: Add broadcast to `updateChecklist`**

In `updateChecklist`, after the response is sent (after line 660 `res.status(200).json(...)`) but before the closing `catch`, add:

```typescript
    // ── Real-time broadcast ──────────────────────────
    if (project.boardId) {
      const boardForChecklist = await prisma.board.findUnique({
        where: { id: project.boardId },
        select: { slug: true },
      });
      if (boardForChecklist?.slug) {
        const updatedProject = await prisma.project.findUnique({
          where: { id },
          include: projectCardIncludes,
        });
        if (updatedProject) {
          emitBoardEvent(
            boardForChecklist.slug,
            'project:updated',
            updatedProject,
            req.headers['x-socket-id'] as string | undefined,
          );
        }
      }
    }
```

- [ ] **Step 7: Add broadcast to `addAttachment`**

In `addAttachment`, after the response is sent (after line 751 `res.status(201).json(...)`) but before the closing `catch`, add:

```typescript
    // ── Real-time broadcast ──────────────────────────
    const boardForAttachment = await prisma.board.findUnique({
      where: { id: project.boardId },
      select: { slug: true },
    });
    if (boardForAttachment?.slug) {
      const updatedProject = await prisma.project.findUnique({
        where: { id },
        include: projectCardIncludes,
      });
      if (updatedProject) {
        emitBoardEvent(
          boardForAttachment.slug,
          'project:updated',
          updatedProject,
          req.headers['x-socket-id'] as string | undefined,
        );
      }
    }
```

Note: In `addAttachment`, the variable `project` is used for the project's `name` (line 734). The `id` is `req.params.id`. And `project.boardId` is available because line 734 fetches `{ name: true }` — but wait, that select doesn't include `boardId`. We need to change the fetch on line 734:

Change line 734 from:
```typescript
    const project = await prisma.project.findUnique({ where: { id }, select: { name: true } });
```
to:
```typescript
    const project = await prisma.project.findUnique({ where: { id }, select: { name: true, boardId: true } });
```

Actually, looking more carefully, there is already a `project` variable declared on line 527 for the `addComment` function. In `addAttachment` (line 714), the project name fetch is on line 734. Let me re-examine:

In `addAttachment`, the project fetch is:
```typescript
    const project = await prisma.project.findUnique({ where: { id }, select: { name: true } });
```

Change `select: { name: true }` to `select: { name: true, boardId: true }` so we have `boardId` for the broadcast.

- [ ] **Step 8: Build backend to verify**

```bash
cd backend && npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add backend/src/controllers/project.controller.ts
git commit -m "feat: broadcast project events via Socket.io after mutations"
```

---

### Task 4: Add socket push to notification controller

**Files:**
- Modify: `backend/src/controllers/notification.controller.ts`

Push notifications via socket immediately after creating them in the DB, so the frontend receives them in real-time instead of waiting for the next poll.

- [ ] **Step 1: Update `createManyNotifications` to push via socket**

In `backend/src/controllers/notification.controller.ts`, add the import at the top (after line 2):

```typescript
import { emitToUser } from '../socket/emitHelper';
```

Then modify the `createManyNotifications` function (lines 16-25). After the `prisma.notification.createMany` call, push each notification to the recipient's socket:

Replace the entire function with:

```typescript
export async function createManyNotifications(items: {
  type: string;
  message: string;
  userId: string;
  projectId?: string;
  actorId?: string;
}[]) {
  if (items.length === 0) return;
  await prisma.notification.createMany({ data: items });

  // Push each notification to the recipient via WebSocket
  for (const item of items) {
    emitToUser(item.userId, 'notification:new', {
      id: `temp-${Date.now()}-${Math.random()}`,
      userId: item.userId,
      type: item.type,
      message: item.message,
      projectId: item.projectId || '',
      read: false,
      timestamp: new Date().toISOString(),
    });
  }
}
```

Also update `createNotification` (lines 6-14) the same way:

```typescript
export async function createNotification(data: {
  type: string;
  message: string;
  userId: string;   // recipient
  projectId?: string;
  actorId?: string;  // who triggered it
}) {
  const notification = await prisma.notification.create({ data });

  // Push to recipient via WebSocket
  emitToUser(data.userId, 'notification:new', {
    id: notification.id,
    userId: data.userId,
    type: data.type,
    message: data.message,
    projectId: data.projectId || '',
    read: false,
    timestamp: notification.createdAt.toISOString(),
  });

  return notification;
}
```

- [ ] **Step 2: Build backend to verify**

```bash
cd backend && npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/notification.controller.ts
git commit -m "feat: push notifications via WebSocket after DB insert"
```

---

### Task 5: Create frontend SocketContext provider

**Files:**
- Create: `frontend/contexts/SocketContext.tsx`
- Modify: `frontend/app/layout.tsx`
- Modify: `frontend/contexts/AppContext.tsx`

- [ ] **Step 1: Create `frontend/contexts/SocketContext.tsx`**

```typescript
'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useApp } from '@/contexts/useApp';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
});

export function useSocket() {
  return useContext(SocketContext);
}

const SOCKET_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api')
  .replace(/\/api$/, ''); // strip /api — Socket.io connects to root

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { state, dispatch } = useApp();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Only connect when user is logged in
    if (!state.currentUser) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      setIsConnected(false);
    });

    // ─── Global notification listener ────────────────
    socket.on('notification:new', (notification: any) => {
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: notification.id,
          userId: notification.userId,
          type: notification.type,
          projectId: notification.projectId || '',
          read: false,
          timestamp: new Date(notification.timestamp),
          message: notification.message,
        },
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [state.currentUser, dispatch]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
```

- [ ] **Step 2: Export `mapApiProject` from AppContext**

In `frontend/contexts/AppContext.tsx`, the `mapApiProject` function (line 517) is currently a private function. We need it in Board.tsx for mapping incoming socket data. Change:

```typescript
function mapApiProject(p: any): Project {
```

to:

```typescript
export function mapApiProject(p: any): Project {
```

- [ ] **Step 3: Remove 30s notification polling from AppContext**

In `frontend/contexts/AppContext.tsx`, the notification polling is in the useEffect on lines 652-678. Remove the `setInterval` and `clearInterval` — notifications now come via socket. Replace:

```typescript
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
```

with:

```typescript
    fetchNotifications();
    // Polling removed — notifications now arrive via WebSocket in SocketContext
```

- [ ] **Step 4: Wrap app with SocketProvider in `frontend/app/layout.tsx`**

In `frontend/app/layout.tsx`, add the import at the top:

```typescript
import { SocketProvider } from '@/contexts/SocketContext'
```

Then wrap `{children}` with `<SocketProvider>` inside the existing `<AppProvider>`:

Change:

```tsx
          <AppProvider>
            {children}
            <Toaster position="bottom-right" richColors closeButton />
          </AppProvider>
```

to:

```tsx
          <AppProvider>
            <SocketProvider>
              {children}
              <Toaster position="bottom-right" richColors closeButton />
            </SocketProvider>
          </AppProvider>
```

- [ ] **Step 5: Build frontend to verify**

```bash
cd frontend && npx next build
```

Expected: Clean build, no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/contexts/SocketContext.tsx frontend/contexts/AppContext.tsx frontend/app/layout.tsx
git commit -m "feat: add SocketProvider with JWT auth, notification listener, remove polling"
```

---

### Task 6: Add board room management and real-time event handling

**Files:**
- Modify: `frontend/components/kanban/Board.tsx`
- Modify: `frontend/app/dashboard/[workspace]/page.tsx`

- [ ] **Step 1: Add room join/leave to workspace page**

In `frontend/app/dashboard/[workspace]/page.tsx`, add the import at the top (after line 11):

```typescript
import { useSocket } from '@/contexts/SocketContext';
```

Then in the `WorkspacePage` component, after the existing hooks (after line 39 `const { canCreateProject, canAddColumn, canSoftDelete } = usePermissions();`), add:

```typescript
  const { socket } = useSocket();
```

Then add a useEffect for room management (after the existing `useEffect` for fetching the board, around line 89):

```typescript
  // Join/leave board room for real-time events
  useEffect(() => {
    if (!socket || !boardSlug) return;
    socket.emit('join:board', boardSlug);
    return () => {
      socket.emit('leave:board', boardSlug);
    };
  }, [socket, boardSlug]);
```

- [ ] **Step 2: Add socket event listeners to Board.tsx**

In `frontend/components/kanban/Board.tsx`, add imports at the top:

```typescript
import { useSocket } from '@/contexts/SocketContext';
import { mapApiProject } from '@/contexts/AppContext';
```

Then inside the `Board` component, after the existing hooks (after line 50 `const { canDragCards } = usePermissions();`), add:

```typescript
  const { socket } = useSocket();
```

Then add a useEffect for listening to real-time project events (after the `useEffect` for `beforeunload` on line 78):

```typescript
  // ─── Real-time event listeners ─────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleProjectCreated = (data: any) => {
      const project = mapApiProject(data);
      // Only add if it belongs to this board
      if (boardId && project.boardId === boardId) {
        // Check if project already exists (avoid duplicates)
        const exists = state.projects.some(p => p.id === project.id);
        if (!exists) {
          dispatch({
            type: 'CREATE_PROJECT',
            payload: { project, userId: '' },
          });
          toast.info(`New card: "${project.name}"`);
        }
      }
    };

    const handleProjectUpdated = (data: any) => {
      const project = mapApiProject(data);
      // Check if we have a pending save for this project
      const pending = pendingSaves.current.get(project.id);
      if (pending) {
        // Another user moved this card while we had a pending save — cancel ours
        clearTimeout(pending.timerId);
        pendingSaves.current.delete(project.id);
        toast.warning(`Card was moved by another user — your change was overridden`);
      }
      dispatch({ type: 'UPDATE_PROJECT', payload: project });
    };

    const handleProjectDeleted = (data: { projectId: string }) => {
      // Cancel any pending save for this project
      const pending = pendingSaves.current.get(data.projectId);
      if (pending) {
        clearTimeout(pending.timerId);
        pendingSaves.current.delete(data.projectId);
      }
      dispatch({
        type: 'DELETE_PROJECT',
        payload: { projectId: data.projectId, userId: '' },
      });
    };

    socket.on('project:created', handleProjectCreated);
    socket.on('project:updated', handleProjectUpdated);
    socket.on('project:deleted', handleProjectDeleted);

    return () => {
      socket.off('project:created', handleProjectCreated);
      socket.off('project:updated', handleProjectUpdated);
      socket.off('project:deleted', handleProjectDeleted);
    };
  }, [socket, boardId, state.projects, dispatch]);
```

- [ ] **Step 3: Add `x-socket-id` header and `lastUpdatedAt` to drag saves**

In Board.tsx, in the `handleDragEnd` function, modify the fetch call (around line 245-252) to include the socket ID header and `lastUpdatedAt`:

Find:
```typescript
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        });
```

Replace with:
```typescript
        const token = localStorage.getItem('token');
        const projectForSave = state.projects.find(p => p.id === projectId);
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(socket?.id ? { 'x-socket-id': socket.id } : {}),
          },
          body: JSON.stringify({
            status: newStatus,
            lastUpdatedAt: projectForSave?.updatedAt?.toISOString(),
          }),
        });
```

- [ ] **Step 4: Handle 409 conflict response in drag save**

In Board.tsx, in the same `handleDragEnd` function, modify the error handling after the fetch. Find:

```typescript
        if (!response.ok) {
          const errData = await response.json().catch(() => ({ message: 'Unknown error' }));
          throw new Error(errData.message || `HTTP ${response.status}`);
        }
```

Replace with:
```typescript
        if (!response.ok) {
          const errData = await response.json().catch(() => ({ message: 'Unknown error' }));
          if (response.status === 409 && errData.conflict) {
            // Another user modified this project — apply their version and revert our drag
            toast.warning(`Card was already moved by ${errData.updatedBy}`);
            if (errData.current) {
              dispatch({ type: 'UPDATE_PROJECT', payload: mapApiProject(errData.current) });
            } else {
              dispatch({
                type: 'UPDATE_PROJECT_STATUS',
                payload: {
                  projectId,
                  newStatus: trueOriginal as Project['status'],
                  userId: state.currentUser?.id || '',
                },
              });
            }
            return;
          }
          throw new Error(errData.message || `HTTP ${response.status}`);
        }
```

- [ ] **Step 5: Add `x-socket-id` header to `handleAddCard`**

In Board.tsx, in the `handleAddCard` function (around line 288-340), modify the fetch headers to include the socket ID:

Find:
```typescript
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
```

Replace with:
```typescript
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(socket?.id ? { 'x-socket-id': socket.id } : {}),
        },
```

- [ ] **Step 6: Build frontend to verify**

```bash
cd frontend && npx next build
```

Expected: Clean build, no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/kanban/Board.tsx frontend/app/dashboard/[workspace]/page.tsx
git commit -m "feat: add real-time board sync with conflict detection"
```

---

### Task 7: Add broadcast to trash restore (project reappears on board)

**Files:**
- Modify: `backend/src/controllers/trash.controller.ts`

When a project is restored from trash, it should reappear on the board in real-time.

- [ ] **Step 1: Add broadcast to `restoreItem` for projects**

In `backend/src/controllers/trash.controller.ts`, add the import at the top (after line 2):

```typescript
import { emitBoardEvent } from '../socket/emitHelper';
import { Request as ExpressRequest } from 'express';
```

In the `restoreItem` function, after the project restoration transaction completes and before the response is sent, add the broadcast. Find the project restoration section — it's the `type === 'project'` branch. After the project is restored, add:

After the `prisma.$transaction([...])` for project restore, add:

```typescript
      // Broadcast project reappearance
      const restoredProject = await prisma.project.findUnique({
        where: { id },
        include: {
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
        },
      });
      if (restoredProject?.board?.slug) {
        emitBoardEvent(
          restoredProject.board.slug,
          'project:created',
          restoredProject,
          req.headers['x-socket-id'] as string | undefined,
        );
      }
```

- [ ] **Step 2: Build backend to verify**

```bash
cd backend && npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/trash.controller.ts
git commit -m "feat: broadcast project restoration via Socket.io"
```

---

### Task 8: Build and verify full stack

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
git commit -m "fix: resolve build errors for real-time sync"
```
