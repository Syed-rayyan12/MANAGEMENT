# Phase-Based My Work Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `phase` field to BoardColumn so My Work can group projects from all workspaces into 4 universal lanes (Not Started, In Progress, Done, On Hold) regardless of custom column names.

**Architecture:** Each BoardColumn gets a `phase` enum (NOT_STARTED, IN_PROGRESS, DONE, ON_HOLD). Phase is set when creating/editing a column. My Work fetches all board columns, builds a phase lookup map, and groups the user's projects by phase instead of hardcoded status keys. Workspace boards are unaffected — they continue showing their custom columns.

**Tech Stack:** Prisma (schema + migration), Express controller, Next.js frontend, Tailwind CSS

---

### Task 1: Add `phase` enum and field to Prisma schema

**Files:**
- Modify: `backend/prisma/schema.prisma:131-144` (BoardColumn model)

- [ ] **Step 1: Add the ColumnPhase enum and phase field**

In `backend/prisma/schema.prisma`, add the enum before the BoardColumn model and add the field:

```prisma
// Add this enum BEFORE the BoardColumn model (after the Board model closing brace)
enum ColumnPhase {
  NOT_STARTED
  IN_PROGRESS
  DONE
  ON_HOLD
}

// Update BoardColumn model to include phase
model BoardColumn {
  id       String      @id @default(uuid())
  name     String
  key      String
  color    String      @default("#6B7280")
  position Int         @default(0)
  phase    ColumnPhase @default(NOT_STARTED)
  boardId  String
  board    Board       @relation(fields: [boardId], references: [id], onDelete: Cascade)

  @@unique([boardId, key])
  @@map("board_columns")
}
```

- [ ] **Step 2: Generate Prisma client**

Run: `npx prisma generate`

- [ ] **Step 3: Create and run migration**

Run: `DATABASE_URL="postgresql://postgres:PJEGMQUYGIBPANktROhvDhjrGrzmosnP@metro.proxy.rlwy.net:26362/railway" npx prisma migrate dev --name add-column-phase`

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add ColumnPhase enum and phase field to BoardColumn"
```

---

### Task 2: Backfill existing columns with correct phases

**Files:**
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Add phase to defaultColumns in seed.ts**

Update the `defaultColumns` array (around line 43):

```typescript
const defaultColumns = [
  { name: 'To Do', key: 'todo', color: '#6B7280', position: 0, phase: 'NOT_STARTED' as const },
  { name: 'In Progress', key: 'in-progress', color: '#3B82F6', position: 1, phase: 'IN_PROGRESS' as const },
  { name: 'Completed', key: 'completed', color: '#10B981', position: 2, phase: 'DONE' as const },
  { name: 'Revisions', key: 'revisions', color: '#F59E0B', position: 3, phase: 'IN_PROGRESS' as const },
];
```

Also update the "Live" column for Web Development (around line 73):

```typescript
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
```

- [ ] **Step 2: Write a backfill script to update existing columns**

Run this one-time SQL via Prisma to set phases on existing columns. Add this at the end of the seed's main function (before the closing brace), guarded so it only runs once:

```typescript
// Backfill phase for existing columns that still have the default NOT_STARTED
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
console.log('✅ Backfilled column phases');
```

- [ ] **Step 3: Run the seed**

Run: `DATABASE_URL="postgresql://postgres:PJEGMQUYGIBPANktROhvDhjrGrzmosnP@metro.proxy.rlwy.net:26362/railway" npx prisma db seed`

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat: backfill phase values for existing board columns"
```

---

### Task 3: Update backend addColumn endpoint to accept phase

**Files:**
- Modify: `backend/src/controllers/board.controller.ts:131-179`

- [ ] **Step 1: Update addBoardColumn to accept and store phase**

In `board.controller.ts`, update the `addBoardColumn` function. Change line 134 to also destructure `phase`:

```typescript
const { name, color, phase } = req.body;
```

Update the `prisma.boardColumn.create` call (around line 164) to include phase:

```typescript
const column = await prisma.boardColumn.create({
  data: {
    boardId,
    name: name.trim(),
    key,
    color: color || '#6B7280',
    position: (maxPos._max.position ?? -1) + 1,
    phase: phase || 'NOT_STARTED',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/controllers/board.controller.ts
git commit -m "feat: accept phase param when creating board columns"
```

---

### Task 4: Update frontend types and API client

**Files:**
- Modify: `frontend/lib/types.ts:29-35` (BoardColumn interface)
- Modify: `frontend/lib/types.ts:37-42` (KanbanColumn interface)
- Modify: `frontend/lib/api-service.ts:383-390` (boardAPI.addColumn)
- Modify: `frontend/lib/constants.ts:6-11` (DEFAULT_KANBAN_COLUMNS)

- [ ] **Step 1: Add ColumnPhase type and update interfaces in types.ts**

After the `BoardColumn` interface (around line 35), add the phase type. Update both interfaces:

```typescript
export type ColumnPhase = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'ON_HOLD';

export interface BoardColumn {
  id: string;
  name: string;
  key: string;
  color: string;
  position: number;
  phase: ColumnPhase;
}

export interface KanbanColumn {
  status: string;
  label: string;
  color: string;
  isCustom?: boolean;
  phase?: ColumnPhase;
}
```

- [ ] **Step 2: Update DEFAULT_KANBAN_COLUMNS in constants.ts**

```typescript
export const DEFAULT_KANBAN_COLUMNS: KanbanColumn[] = [
  { status: 'todo', label: 'To Do', color: '#6B7280', isCustom: false, phase: 'NOT_STARTED' },
  { status: 'in-progress', label: 'In Progress', color: '#3B82F6', isCustom: false, phase: 'IN_PROGRESS' },
  { status: 'completed', label: 'Completed', color: '#10B981', isCustom: false, phase: 'DONE' },
  { status: 'revisions', label: 'Revisions', color: '#F59E0B', isCustom: false, phase: 'IN_PROGRESS' },
];
```

- [ ] **Step 3: Update boardAPI.addColumn to send phase**

In `api-service.ts`, update the `addColumn` method:

```typescript
addColumn: async (boardId: string, name: string, color?: string, phase?: string) => {
  const response = await apiFetch(`${API_BASE_URL}/boards/${boardId}/columns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color, phase }),
  });
  return await response.json();
},
```

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/types.ts frontend/lib/constants.ts frontend/lib/api-service.ts
git commit -m "feat: add phase to frontend types, constants, and API client"
```

---

### Task 5: Add phase picker to Add Column modal

**Files:**
- Modify: `frontend/app/dashboard/[workspace]/page.tsx:86-106` (handleAddColumn)
- Modify: `frontend/app/dashboard/[workspace]/page.tsx:287-348` (AddColumnModal)

- [ ] **Step 1: Update handleAddColumn to pass phase**

Around line 86, update the handler signature and column creation:

```typescript
const handleAddColumn = async (columnName: string, columnColor: string, columnPhase: string) => {
  const newColumn = {
    status: columnName.toLowerCase().replace(/\s+/g, '-'),
    label: columnName,
    color: columnColor,
    isCustom: true,
    phase: columnPhase,
  };

  const updatedColumns = [...customColumns, newColumn];
  setCustomColumns(updatedColumns);
  setRefreshKey(prev => prev + 1);

  if (boardId) {
    try {
      await boardAPI.addColumn(boardId, columnName, columnColor, columnPhase);
    } catch (error) {
      console.error('Error saving column:', error);
    }
  }
};
```

- [ ] **Step 2: Update AddColumnModal to include phase selector**

Replace the entire `AddColumnModal` function (lines 287-348):

```tsx
function AddColumnModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, color: string, phase: string) => void }) {
  const [columnName, setColumnName] = useState('');
  const [columnColor, setColumnColor] = useState('#3B82F6');
  const [columnPhase, setColumnPhase] = useState('IN_PROGRESS');

  const handleAddColumn = () => {
    if (!columnName.trim()) {
      alert('Column name is required');
      return;
    }
    onAdd(columnName.trim(), columnColor, columnPhase);
    onClose();
  };

  const phases = [
    { value: 'NOT_STARTED', label: 'Not Started', description: 'Work hasn\'t begun yet', color: 'text-zinc-500' },
    { value: 'IN_PROGRESS', label: 'In Progress', description: 'Actively being worked on', color: 'text-blue-500' },
    { value: 'DONE', label: 'Done', description: 'Work is complete', color: 'text-emerald-500' },
    { value: 'ON_HOLD', label: 'On Hold', description: 'Paused or blocked', color: 'text-amber-500' },
  ];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Add New Column</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <Label htmlFor="columnName" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Column Name *</Label>
            <Input
              id="columnName"
              placeholder="Enter column name"
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
              className="mt-1 placeholder:text-gray-400"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Phase *</Label>
            <p className="text-xs text-zinc-400 mt-0.5 mb-2">How this column appears in the cross-board "My Work" view</p>
            <div className="grid grid-cols-2 gap-2">
              {phases.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setColumnPhase(p.value)}
                  className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                    columnPhase === p.value
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <span className={`text-sm font-medium ${p.color}`}>{p.label}</span>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{p.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="columnColor" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Column Color</Label>
            <div className="mt-2 flex gap-2">
              {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map((color) => (
                <button
                  key={color}
                  onClick={() => setColumnColor(color)}
                  className={`w-8 h-8 rounded-full border-2 ${
                    columnColor === color ? 'border-orange-500 scale-110' : 'border-gray-300'
                  } transition-all`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleAddColumn} className="flex-1 text-white bg-gradient-to-r from-[#e05c29] to-orange-400 hover:to-rose-500 shadow-[0_4px_20px_rgba(224,92,41,0.35)]">
              Add Column
            </Button>
            <Button onClick={onClose} variant="outline" className="flex-1 text-zinc-700 dark:text-zinc-300">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Update workspace page column mapping to include phase**

In the `useEffect` that fetches the board (around line 66-74), update the column mapping:

```typescript
const cols = board.columns
  .sort((a: any, b: any) => a.position - b.position)
  .map((c: any) => ({
    status: c.key,
    label: c.name,
    color: c.color,
    isCustom: false,
    phase: c.phase || 'NOT_STARTED',
  }));
setCustomColumns(cols);
```

- [ ] **Step 4: Commit**

```bash
git add frontend/app/dashboard/[workspace]/page.tsx
git commit -m "feat: add phase picker to Add Column modal"
```

---

### Task 6: Add backend endpoint to fetch all columns for user's boards

**Files:**
- Modify: `backend/src/controllers/board.controller.ts` (add new function)
- Modify: `backend/src/routes/board.routes.ts` (add new route)
- Modify: `frontend/lib/api-service.ts` (add new API method)

- [ ] **Step 1: Add getAllColumnsForUser controller**

Add this function at the end of `board.controller.ts` (before the file ends):

```typescript
/**
 * Get all board columns (with phase) for boards the user has projects on.
 * GET /api/boards/columns/all
 */
export const getAllBoardColumns = async (req: Request, res: Response): Promise<void> => {
  try {
    const columns = await prisma.boardColumn.findMany({
      orderBy: { position: 'asc' },
      select: { key: true, phase: true, boardId: true },
    });

    // Build a lookup: { "board-id::column-key": "IN_PROGRESS" }
    const phaseMap: Record<string, string> = {};
    columns.forEach((c) => {
      phaseMap[`${c.boardId}::${c.key}`] = c.phase;
    });

    res.json({ success: true, data: { phaseMap } });
  } catch (error) {
    console.error('Get all board columns error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
```

- [ ] **Step 2: Add the route**

In `board.routes.ts`, import the new function and add the route BEFORE any `/:boardId` routes (to avoid param conflicts):

```typescript
// Add to imports
import { ..., getAllBoardColumns } from '../controllers/board.controller';

// Add BEFORE /:boardId routes
router.get('/columns/all', getAllBoardColumns);
```

- [ ] **Step 3: Add frontend API method**

In `api-service.ts`, add to the `boardAPI` object (before the closing `}`):

```typescript
getAllColumns: async () => {
  const response = await apiFetch(`${API_BASE_URL}/boards/columns/all`);
  return await response.json();
},
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/board.controller.ts backend/src/routes/board.routes.ts frontend/lib/api-service.ts
git commit -m "feat: add endpoint to fetch all board column phases"
```

---

### Task 7: Rewrite My Work page to use phase-based grouping

**Files:**
- Modify: `frontend/app/dashboard/my-work/page.tsx` (full rewrite of data logic)

- [ ] **Step 1: Rewrite the My Work page**

Replace the entire contents of `frontend/app/dashboard/my-work/page.tsx`:

```tsx
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/useApp';
import { useSearch } from '../layout';
import { boardAPI } from '@/lib/api-service';
import { BoardSkeleton } from '@/components/ui/skeletons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Filter, SortAsc, X, Briefcase, Calendar, MessageSquare, Paperclip, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProjectModal } from '@/components/project/ProjectModal';
import { Project, ColumnPhase } from '@/lib/types';
import { PRIORITY_STYLES } from '@/lib/constants';

const PHASE_CONFIG: Record<ColumnPhase, { label: string; color: string; bgColor: string; borderColor: string }> = {
  NOT_STARTED: { label: 'Not Started', color: 'text-zinc-500', bgColor: 'bg-zinc-100/70 dark:bg-zinc-900/40', borderColor: 'border-zinc-300 dark:border-zinc-700' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-blue-500', bgColor: 'bg-blue-50/50 dark:bg-blue-900/10', borderColor: 'border-blue-300 dark:border-blue-800' },
  DONE: { label: 'Done', color: 'text-emerald-500', bgColor: 'bg-emerald-50/50 dark:bg-emerald-900/10', borderColor: 'border-emerald-300 dark:border-emerald-800' },
  ON_HOLD: { label: 'On Hold', color: 'text-amber-500', bgColor: 'bg-amber-50/50 dark:bg-amber-900/10', borderColor: 'border-amber-300 dark:border-amber-800' },
};

const PHASE_ORDER: ColumnPhase[] = ['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'ON_HOLD'];

interface BoardOption {
  id: string;
  name: string;
}

export default function MyWorkPage() {
  const { state, isLoading, getUserAvatar } = useApp();
  const { searchQuery } = useSearch();
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterBoard, setFilterBoard] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [boardOptions, setBoardOptions] = useState<BoardOption[]>([]);
  const [phaseMap, setPhaseMap] = useState<Record<string, string>>({});
  const [phaseMapLoading, setPhaseMapLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const currentUserId = state.currentUser?.id;

  // Fetch boards and phase map
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [boardsResult, columnsResult] = await Promise.all([
          boardAPI.getAll(),
          boardAPI.getAllColumns(),
        ]);
        if (boardsResult.success) {
          setBoardOptions(boardsResult.data.boards.map((b: any) => ({ id: b.id, name: b.name })));
        }
        if (columnsResult.success) {
          setPhaseMap(columnsResult.data.phaseMap);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setPhaseMapLoading(false);
      }
    };
    fetchData();
  }, []);

  // Get projects assigned to me
  const myProjects = useMemo(() => {
    if (!currentUserId) return [];
    return state.projects.filter(
      (p) => p.assignments.some(a => a.userId === currentUserId)
    );
  }, [state.projects, currentUserId]);

  // Resolve phase for a project
  const getPhase = (project: Project): ColumnPhase => {
    const key = `${project.boardId}::${project.status}`;
    return (phaseMap[key] as ColumnPhase) || 'NOT_STARTED';
  };

  // Filter and sort
  const processedProjects = useMemo(() => {
    let filtered = myProjects;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q));
    }
    if (filterPriority !== 'all') {
      filtered = filtered.filter(p => p.priority === filterPriority);
    }
    if (filterBoard !== 'all') {
      filtered = filtered.filter(p => p.boardId === filterBoard);
    }

    // Sort
    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'priority') {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
      }
      // date
      const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return aDate - bDate;
    });
  }, [myProjects, searchQuery, filterPriority, filterBoard, sortBy]);

  // Group by phase
  const projectsByPhase = useMemo(() => {
    const grouped: Record<ColumnPhase, Project[]> = {
      NOT_STARTED: [],
      IN_PROGRESS: [],
      DONE: [],
      ON_HOLD: [],
    };
    processedProjects.forEach(p => {
      const phase = getPhase(p);
      grouped[phase].push(p);
    });
    return grouped;
  }, [processedProjects, phaseMap]);

  // Stats
  const stats = useMemo(() => ({
    total: myProjects.length,
    notStarted: myProjects.filter(p => getPhase(p) === 'NOT_STARTED').length,
    inProgress: myProjects.filter(p => getPhase(p) === 'IN_PROGRESS').length,
    done: myProjects.filter(p => getPhase(p) === 'DONE').length,
    overdue: myProjects.filter(p =>
      p.dueDate && new Date(p.dueDate) < new Date() && getPhase(p) !== 'DONE'
    ).length,
  }), [myProjects, phaseMap]);

  const selectedProject = state.projects.find(p => p.id === selectedProjectId) || null;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">My Work</h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">All tasks assigned to you across boards</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2 text-zinc-600 dark:text-zinc-400" />
                <span className="text-zinc-700 dark:text-zinc-300">
                  Priority: {filterPriority === 'all' ? 'All' : filterPriority}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Filter by Priority</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setFilterPriority('all')}>All</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterPriority('critical')}>Critical</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterPriority('high')}>High</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterPriority('medium')}>Medium</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterPriority('low')}>Low</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Briefcase className="w-4 h-4 mr-2 text-zinc-600 dark:text-zinc-400" />
                <span className="text-zinc-700 dark:text-zinc-300">
                  Board: {filterBoard === 'all' ? 'All' : boardOptions.find(b => b.id === filterBoard)?.name || filterBoard}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Filter by Board</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setFilterBoard('all')}>All Boards</DropdownMenuItem>
              {boardOptions.map((b) => (
                <DropdownMenuItem key={b.id} onClick={() => setFilterBoard(b.id)}>
                  {b.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <SortAsc className="w-4 h-4 mr-2 text-zinc-600 dark:text-zinc-400" />
                <span className="text-zinc-700 dark:text-zinc-300">
                  Sort: {sortBy === 'date' ? 'Date' : sortBy === 'name' ? 'Name' : 'Priority'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Sort Projects</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSortBy('date')}>Due Date</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('name')}>Name</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('priority')}>Priority</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-zinc-900 dark:text-zinc-100', bg: 'bg-zinc-500/10 border-zinc-500/20' },
          { label: 'Not Started', value: stats.notStarted, color: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20' },
          { label: 'In Progress', value: stats.inProgress, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
          { label: 'Done', value: stats.done, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Overdue', value: stats.overdue, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
        ].map((s) => (
          <div key={s.label} className={`rounded-lg border px-4 py-3 ${s.bg}`}>
            <p className="text-xs text-zinc-400 uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Active Filters */}
      {(filterPriority !== 'all' || filterBoard !== 'all' || searchQuery) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-zinc-400">Active filters:</span>
          {searchQuery && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30">
              Search: &quot;{searchQuery}&quot;
            </span>
          )}
          {filterPriority !== 'all' && (
            <button onClick={() => setFilterPriority('all')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30 hover:bg-orange-500/25 transition-colors">
              Priority: {filterPriority} <X className="w-3 h-3" />
            </button>
          )}
          {filterBoard !== 'all' && (
            <button onClick={() => setFilterBoard('all')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30 hover:bg-orange-500/25 transition-colors">
              Board: {boardOptions.find(b => b.id === filterBoard)?.name || filterBoard} <X className="w-3 h-3" />
            </button>
          )}
          <button onClick={() => { setFilterPriority('all'); setFilterBoard('all'); }} className="text-xs text-zinc-500 hover:text-orange-400 transition-colors underline">
            Clear all
          </button>
        </div>
      )}

      {/* Phase Lanes */}
      {isLoading || phaseMapLoading ? (
        <BoardSkeleton />
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-5 min-w-max">
            {PHASE_ORDER.map((phase) => {
              const config = PHASE_CONFIG[phase];
              const projects = projectsByPhase[phase];
              return (
                <div key={phase} className={`flex flex-col rounded-xl p-3 w-[300px] min-w-[300px] max-w-[300px] h-[calc(100vh-280px)] border border-transparent ${config.bgColor}`}>
                  {/* Header */}
                  <div className="mb-3 flex items-center gap-2 flex-shrink-0">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      phase === 'NOT_STARTED' ? 'bg-zinc-400' :
                      phase === 'IN_PROGRESS' ? 'bg-blue-500' :
                      phase === 'DONE' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`} />
                    <h3 className={`font-semibold text-sm ${config.color}`}>{config.label}</h3>
                    <span className="bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 text-xs font-medium px-2 py-0.5 rounded-full">
                      {projects.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                    {projects.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-zinc-400 dark:text-zinc-500">
                        <p className="text-sm">No projects</p>
                      </div>
                    ) : (
                      projects.map((project) => (
                        <MyWorkCard
                          key={project.id}
                          project={project}
                          boardName={boardOptions.find(b => b.id === project.boardId)?.name}
                          onClick={() => setSelectedProjectId(project.id)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Project Modal */}
      {selectedProject && (
        <ProjectModal
          project={selectedProject}
          onClose={() => setSelectedProjectId(null)}
        />
      )}
    </div>
  );
}

function MyWorkCard({ project, boardName, onClick }: { project: Project; boardName?: string; onClick: () => void }) {
  const priorityStyle = PRIORITY_STYLES[project.priority];
  const isOverdue = project.dueDate && new Date(project.dueDate) < new Date() && project.status !== 'completed';

  const priorityDotColor: Record<string, string> = {
    low: 'bg-zinc-400',
    medium: 'bg-amber-500',
    high: 'bg-[#e05c29]',
    critical: 'bg-red-500',
  };

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-zinc-900/90 shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 rounded-lg p-3 space-y-2"
    >
      {/* Board badge + title */}
      {boardName && (
        <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
          {boardName}
        </span>
      )}
      <h4 className="text-sm font-medium text-zinc-800 dark:text-zinc-100 line-clamp-2 leading-snug">
        {project.name}
      </h4>

      {/* Footer */}
      <div className="flex items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500">
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${priorityDotColor[project.priority] || 'bg-zinc-400'}`} />
          <span className={`font-medium ${priorityStyle.color}`}>{priorityStyle.label}</span>
        </span>

        {project.dueDate && <span className="text-zinc-300 dark:text-zinc-700">|</span>}

        {isOverdue && (
          <span className="flex items-center gap-0.5 text-red-500 font-medium">
            <Clock className="w-3 h-3" /> Overdue
          </span>
        )}
        {project.dueDate && !isOverdue && (
          <span className="flex items-center gap-0.5">
            <Calendar className="w-3 h-3" />
            {new Date(project.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}

        <span className="flex-1" />

        {project.comments.length > 0 && (
          <span className="flex items-center gap-0.5">
            <MessageSquare className="w-3 h-3" /> {project.comments.length}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/dashboard/my-work/page.tsx
git commit -m "feat: rewrite My Work page with phase-based grouping"
```

---

### Task 8: Build and verify

**Files:** None (verification only)

- [ ] **Step 1: Build frontend**

Run: `cd frontend && npx next build`

Expected: Clean build, no errors.

- [ ] **Step 2: Build backend**

Run: `cd backend && npx tsc --noEmit`

Expected: No TypeScript errors.

- [ ] **Step 3: Verify phase map endpoint**

Run: `curl -s -H "Authorization: Bearer <token>" http://localhost:5000/api/boards/columns/all | jq .`

Expected: JSON with `phaseMap` containing entries like `"board-id::todo": "NOT_STARTED"`.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete phase-based My Work implementation"
```
