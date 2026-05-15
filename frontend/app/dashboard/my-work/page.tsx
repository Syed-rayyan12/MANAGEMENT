'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/useApp';
import { useSearch } from '../layout';
import { boardAPI } from '@/lib/api-service';
import { Board } from '@/components/kanban/Board';
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
import { Filter, SortAsc, X, Briefcase } from 'lucide-react';

interface BoardOption {
  id: string;
  name: string;
}

export default function MyWorkPage() {
  const { state, isLoading, getUserName } = useApp();
  const { searchQuery } = useSearch();
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterBoard, setFilterBoard] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [boardOptions, setBoardOptions] = useState<BoardOption[]>([]);

  const currentUserId = state.currentUser?.id;

  // Fetch available boards for filter dropdown
  useEffect(() => {
    const fetchBoards = async () => {
      try {
        const result = await boardAPI.getAll();
        if (result.success) {
          setBoardOptions(
            result.data.boards.map((b: any) => ({ id: b.id, name: b.name }))
          );
        }
      } catch (error) {
        console.error('Error fetching boards:', error);
      }
    };
    fetchBoards();
  }, []);

  const currentUserName = state.currentUser?.name || '';

  // Get projects assigned to me (as developer, PM, or member via labels)
  const myProjects = useMemo(() => {
    if (!currentUserId) return [];
    return state.projects.filter(
      (p) => p.assignments.some(a => a.userId === currentUserId)
    );
  }, [state.projects, currentUserId, currentUserName]);

  // Stats — use inclusive matching to handle dynamic board column keys
  const stats = useMemo(() => {
    const total = myProjects.length;
    const todo = myProjects.filter((p) => p.status.includes('todo') || p.status.includes('to-do')).length;
    const inProgress = myProjects.filter((p) =>
      p.status.includes('progress') || p.status.includes('revision') ||
      (!p.status.includes('todo') && !p.status.includes('to-do') && !p.status.includes('completed') && !p.status.includes('done'))
    ).length;
    const completed = myProjects.filter((p) => p.status.includes('completed') || p.status.includes('done')).length;
    const overdue = myProjects.filter(
      (p) => p.dueDate && new Date(p.dueDate) < new Date() && !p.status.includes('completed') && !p.status.includes('done')
    ).length;
    return { total, todo, inProgress, completed, overdue };
  }, [myProjects]);

  // Board breakdown - group by board name
  const boardBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    myProjects.forEach((p) => {
      const bName = p.board?.name || 'Unknown';
      counts[bName] = (counts[bName] || 0) + 1;
    });
    return counts;
  }, [myProjects]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">My Work</h1>
              <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">
                All tasks assigned to you across boards
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
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

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-zinc-900 dark:text-zinc-100', bg: 'bg-zinc-500/10 border-zinc-500/20' },
          { label: 'To Do', value: stats.todo, color: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20' },
          { label: 'In Progress', value: stats.inProgress, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Completed', value: stats.completed, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Overdue', value: stats.overdue, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
        ].map((s) => (
          <div
            key={s.label}
            className={`rounded-lg border px-4 py-3 ${s.bg}`}
          >
            <p className="text-xs text-gray-400 uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Active Filters */}
      {(filterPriority !== 'all' || filterBoard !== 'all' || searchQuery) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-400">Active filters:</span>
          {searchQuery && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30">
              Search: &quot;{searchQuery}&quot;
            </span>
          )}
          {filterPriority !== 'all' && (
            <button
              onClick={() => setFilterPriority('all')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30 hover:bg-orange-500/25 transition-colors"
            >
              Priority: {filterPriority}
              <X className="w-3 h-3" />
            </button>
          )}
          {filterBoard !== 'all' && (
            <button
              onClick={() => setFilterBoard('all')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30 hover:bg-orange-500/25 transition-colors"
            >
              Board: {boardOptions.find(b => b.id === filterBoard)?.name || filterBoard}
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => {
              setFilterPriority('all');
              setFilterBoard('all');
            }}
            className="text-xs text-gray-500 hover:text-orange-400 transition-colors underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Board - filtered to my work */}
      <div>
        {isLoading ? (
          <BoardSkeleton />
        ) : (
          <Board
            searchQuery={searchQuery}
            filterPriority={filterPriority}
            filterAssignee={currentUserId || ''}
            sortBy={sortBy}
            boardId={filterBoard === 'all' ? null : filterBoard}
          />
        )}
      </div>
    </div>
  );
}
