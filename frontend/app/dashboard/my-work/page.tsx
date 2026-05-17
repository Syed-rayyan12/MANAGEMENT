'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { Filter, SortAsc, X, Briefcase, Calendar, MessageSquare, Clock } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { ProjectModal } from '@/components/project/ProjectModal';
import { Project, ColumnPhase } from '@/lib/types';
import { PRIORITY_STYLES } from '@/lib/constants';

const PHASE_CONFIG: Record<ColumnPhase, { label: string; color: string; bgColor: string; borderColor: string }> = {
  NOT_STARTED: { label: 'Not Started', color: 'text-fg-3', bgColor: 'bg-surface-2', borderColor: 'border-border' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-status-blue', bgColor: 'bg-status-blue-soft', borderColor: 'border-status-blue/20' },
  DONE: { label: 'Done', color: 'text-status-green', bgColor: 'bg-status-green-soft', borderColor: 'border-status-green/20' },
  ON_HOLD: { label: 'On Hold', color: 'text-status-amber', bgColor: 'bg-status-amber-soft', borderColor: 'border-status-amber/20' },
};

const PHASE_ORDER: ColumnPhase[] = ['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'ON_HOLD'];

interface BoardOption {
  id: string;
  name: string;
}

export default function MyWorkPage() {
  const { state, isLoading, getUserAvatar } = useApp();
  const { searchQuery } = useSearch();
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get('project');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterBoard, setFilterBoard] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [boardOptions, setBoardOptions] = useState<BoardOption[]>([]);
  const [phaseMap, setPhaseMap] = useState<Record<string, string>>({});
  const [phaseMapLoading, setPhaseMapLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projectIdFromUrl);

  const isMobile = useIsMobile();
  const currentUserId = state.currentUser?.id;

  // Sync project from URL
  useEffect(() => {
    setSelectedProjectId(projectIdFromUrl);
  }, [projectIdFromUrl]);

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
        const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [myProjects, phaseMap]);

  const selectedProject = state.projects.find(p => p.id === selectedProjectId) || null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-foreground tracking-[-0.02em]">My Work</h1>
          <p className="text-[13px] text-fg-3 mt-0.5">All tasks assigned to you across boards</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent-soft text-accent border border-accent-line">
              Search: &quot;{searchQuery}&quot;
            </span>
          )}
          {filterPriority !== 'all' && (
            <button onClick={() => setFilterPriority('all')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent-soft text-accent border border-accent-line hover:bg-accent-soft/80 transition-colors">
              Priority: {filterPriority} <X className="w-3 h-3" />
            </button>
          )}
          {filterBoard !== 'all' && (
            <button onClick={() => setFilterBoard('all')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent-soft text-accent border border-accent-line hover:bg-accent-soft/80 transition-colors">
              Board: {boardOptions.find(b => b.id === filterBoard)?.name || filterBoard} <X className="w-3 h-3" />
            </button>
          )}
          <button onClick={() => { setFilterPriority('all'); setFilterBoard('all'); }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors">
            <X className="w-3 h-3" />
            Clear all
          </button>
        </div>
      )}

      {/* Mobile Phase Indicator Bar */}
      {isMobile && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {PHASE_ORDER.map((phase) => {
            const config = PHASE_CONFIG[phase];
            const count = projectsByPhase[phase].length;
            return (
              <button
                key={phase}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border border-border bg-surface text-fg-2 flex-shrink-0"
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  phase === 'NOT_STARTED' ? 'bg-zinc-400' :
                  phase === 'IN_PROGRESS' ? 'bg-blue-500' :
                  phase === 'DONE' ? 'bg-emerald-500' : 'bg-amber-500'
                }`} />
                {config.label}
                <span className="text-fg-4">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Phase Lanes */}
      {isLoading || phaseMapLoading ? (
        <BoardSkeleton />
      ) : (
        <div className={`overflow-x-auto pb-4 ${isMobile ? 'snap-x snap-mandatory scroll-smooth' : ''}`}>
          <div className={`flex gap-5 ${isMobile ? '' : 'min-w-max'}`}>
            {PHASE_ORDER.map((phase) => {
              const config = PHASE_CONFIG[phase];
              const projects = projectsByPhase[phase];
              return (
                <div key={phase} className={`flex flex-col rounded-lg p-3 ${isMobile ? 'w-[86vw] min-w-[86vw] max-w-[320px] snap-start' : 'w-[296px] min-w-[296px] max-w-[296px]'} h-[calc(100vh-280px)] bg-surface-2 border border-border`}>
                  {/* Header */}
                  <div className="mb-3 flex items-center gap-2 flex-shrink-0">
                    <div className={`w-2 h-2 rounded-full ${
                      phase === 'NOT_STARTED' ? 'bg-zinc-400' :
                      phase === 'IN_PROGRESS' ? 'bg-blue-500' :
                      phase === 'DONE' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`} />
                    <h3 className="text-[12.5px] font-semibold text-foreground">{config.label}</h3>
                    <span className="text-[11px] font-mono font-medium text-fg-3 bg-surface-3 px-1.5 py-0.5 rounded">
                      {projects.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                    {projects.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-zinc-400 dark:text-zinc-500">
                        <div className="w-9 h-9 rounded-lg bg-surface-3 flex items-center justify-center mb-2">
                          <Briefcase className="w-4 h-4 text-fg-4" />
                        </div>
                        <p className="text-[12px] font-medium">No projects here</p>
                        <p className="text-[11px] mt-0.5 text-fg-4">Projects will appear once assigned to you</p>
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
  const isMobile = useIsMobile();
  const priorityStyle = PRIORITY_STYLES[project.priority];
  const isOverdue = project.dueDate && new Date(project.dueDate) < new Date() && project.status !== 'completed';

  const priorityDotColor: Record<string, string> = {
    low: 'bg-zinc-400',
    medium: 'bg-amber-500',
    high: 'bg-accent',
    critical: 'bg-red-500',
  };

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-zinc-900/90 shadow-sm hover:shadow-md cursor-pointer transition-all duration-200 rounded-lg overflow-hidden space-y-2"
    >
      {/* Cover image */}
      {project.image && (
        <div className="w-full h-[80px] overflow-hidden">
          <img src={project.image} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      {/* Board badge + title */}
      <div className={`${project.image ? 'px-3 pb-3' : 'p-3'} space-y-2`}>
      {boardName && (
        <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
          {boardName}
        </span>
      )}
      <h4 className="text-sm font-medium text-zinc-800 dark:text-zinc-100 line-clamp-2 leading-snug">
        {project.name}
      </h4>

      {/* Footer */}
      <div className={`flex items-center gap-2 ${isMobile ? 'text-xs' : 'text-[11px]'} text-zinc-400 dark:text-zinc-500`}>
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
    </div>
  );
}
