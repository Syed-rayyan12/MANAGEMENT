'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/useApp';
import { useSearch } from '../layout';
import { teamAPI } from '@/lib/api-service';
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

interface WorkspaceOption {
  id: string;
  name: string;
}

export default function MyWorkPage() {
  const { state, isLoading, getUserName } = useApp();
  const { searchQuery } = useSearch();
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterWorkspace, setFilterWorkspace] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [workspaceOptions, setWorkspaceOptions] = useState<WorkspaceOption[]>([]);

  const currentUserId = state.currentUser?.id;

  // Fetch available workspaces for filter dropdown
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const result = await teamAPI.getMyTeams();
        if (result.success) {
          setWorkspaceOptions(
            result.data.teams
              .filter((t: any) => t.workspace)
              .map((t: any) => ({ id: t.workspace.id, name: t.name }))
          );
        }
      } catch (error) {
        console.error('Error fetching teams:', error);
      }
    };
    fetchTeams();
  }, []);

  // Get projects assigned to me (as developer or PM)
  const myProjects = useMemo(() => {
    if (!currentUserId) return [];
    return state.projects.filter(
      (p) => p.developer === currentUserId || p.pm === currentUserId
    );
  }, [state.projects, currentUserId]);

  // Stats
  const stats = useMemo(() => {
    const total = myProjects.length;
    const todo = myProjects.filter((p) => p.status === 'todo').length;
    const inProgress = myProjects.filter((p) => p.status === 'in-progress').length;
    const completed = myProjects.filter((p) => p.status === 'completed').length;
    const overdue = myProjects.filter(
      (p) => p.dueDate && new Date(p.dueDate) < new Date() && p.status !== 'completed'
    ).length;
    return { total, todo, inProgress, completed, overdue };
  }, [myProjects]);

  // Workspace breakdown - group by workspace name
  const workspaceBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    myProjects.forEach((p) => {
      const wsName = p.workspace?.name || 'Unknown';
      counts[wsName] = (counts[wsName] || 0) + 1;
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
              <h1 className="text-3xl font-bold text-gray-900 dark:text-orange-400">My Work</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-0.5">
                All tasks assigned to you across workspaces
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2 text-white" />
                <span className="text-white">
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
                <Briefcase className="w-4 h-4 mr-2 text-white" />
                <span className="text-white">
                  Workspace: {filterWorkspace === 'all' ? 'All' : workspaceOptions.find(w => w.id === filterWorkspace)?.name || filterWorkspace}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Filter by Workspace</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setFilterWorkspace('all')}>All Workspaces</DropdownMenuItem>
              {workspaceOptions.map((ws) => (
                <DropdownMenuItem key={ws.id} onClick={() => setFilterWorkspace(ws.id)}>
                  {ws.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <SortAsc className="w-4 h-4 mr-2 text-white" />
                <span className="text-white">
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
          { label: 'Total', value: stats.total, color: 'text-white', bg: 'bg-gray-500/20 border-gray-500/30' },
          { label: 'To Do', value: stats.todo, color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' },
          { label: 'In Progress', value: stats.inProgress, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
          { label: 'Completed', value: stats.completed, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
          { label: 'Overdue', value: stats.overdue, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
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
      {(filterPriority !== 'all' || filterWorkspace !== 'all' || searchQuery) && (
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
          {filterWorkspace !== 'all' && (
            <button
              onClick={() => setFilterWorkspace('all')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30 hover:bg-orange-500/25 transition-colors"
            >
              Workspace: {workspaceOptions.find(w => w.id === filterWorkspace)?.name || filterWorkspace}
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => {
              setFilterPriority('all');
              setFilterWorkspace('all');
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
            workspace={filterWorkspace === 'all' ? null : filterWorkspace}
          />
        )}
      </div>
    </div>
  );
}
