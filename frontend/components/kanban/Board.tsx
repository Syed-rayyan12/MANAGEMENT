


'use client';
import { API_BASE_URL } from '@/lib/api-service';
import { toast } from 'sonner';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Project } from '@/lib/types';
import { DEFAULT_KANBAN_COLUMNS } from '@/lib/constants';
import { useApp } from '@/contexts/useApp';
import { Column } from './Column';
import { ProjectCard } from './Card';
import { ProjectModal } from '../project/ProjectModal';
import { usePermissions } from '@/hooks/usePermissions';

interface BoardProps {
  searchQuery?: string;
  filterPriority?: string;
  filterAssignee?: string;
  sortBy?: string;
  boardId?: string | null;
  customColumns?: any[];
}

export function Board({ searchQuery = '', filterPriority = 'all', filterAssignee = 'all', sortBy = 'date', boardId = null, customColumns = [] }: BoardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get('project');
  
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projectIdFromUrl);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [originalStatus, setOriginalStatus] = useState<string | null>(null);
  const { state, dispatch, getUserName } = useApp();
  const { canDragCards } = usePermissions();

  // Debounced save: card must settle in a column for 1.5s before hitting backend
  const pendingSaves = useRef<Map<string, {
    timerId: ReturnType<typeof setTimeout>;
    newStatus: string;
    savedFromStatus: string; // the FIRST original status before any pending moves
  }>>(new Map());

  // Flush pending saves on page unload to prevent data loss
  useEffect(() => {
    const handleBeforeUnload = () => {
      pendingSaves.current.forEach((pending, projectId) => {
        clearTimeout(pending.timerId);
        const token = localStorage.getItem('token');
        const blob = new Blob(
          [JSON.stringify({ status: pending.newStatus })],
          { type: 'application/json' }
        );
        navigator.sendBeacon(
          `${API_BASE_URL}/projects/${projectId}`,
          blob
        );
      });
      pendingSaves.current.clear();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Update selected project when URL changes
  useEffect(() => {
    setSelectedProjectId(projectIdFromUrl);
  }, [projectIdFromUrl]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: canDragCards ? 8 : Infinity,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Use custom columns if provided (from workspace API), otherwise use defaults
  const allColumns = customColumns.length > 0 ? customColumns : DEFAULT_KANBAN_COLUMNS;

  // Filter projects by search, priority, assignee, and workspace
  const filteredProjects = useMemo(() => {
    return state.projects.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           p.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPriority = filterPriority === 'all' || p.priority === filterPriority;
      const matchesAssignee = filterAssignee === 'all' || p.assignments.some(a => a.userId === filterAssignee);
      const matchesBoard = !boardId || p.boardId === boardId;
      return matchesSearch && matchesPriority && matchesAssignee && matchesBoard;
    });
  }, [state.projects, searchQuery, filterPriority, filterAssignee, boardId]);

  // Sort projects
  const sortedProjects = useMemo(() => {
    const projects = [...filteredProjects];
    if (sortBy === 'name') {
      projects.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'priority') {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      projects.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    } else if (sortBy === 'date') {
      projects.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    } else {
      projects.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    }
    return projects;
  }, [filteredProjects, sortBy]);

  // Group projects by status
  const projectsByStatus = useMemo(() => {
    const grouped: Record<string, Project[]> = {};
    allColumns.forEach((col) => {
      grouped[col.status] = sortedProjects.filter((p) => p.status === col.status);
    });
    return grouped;
  }, [sortedProjects, allColumns]);

  const activeProject = useMemo(
    () => state.projects.find((p) => p.id === activeId) ?? null,
    [activeId, state.projects]
  );

  // ─── Find which column a project/card belongs to ────────────
  const findColumnOfId = useCallback(
    (id: string): string | null => {
      // Is it a column id?
      if (allColumns.some(col => col.status === id)) return id;
      // Is it a project id?
      const project = state.projects.find(p => p.id === id);
      return project ? project.status : null;
    },
    [allColumns, state.projects]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveId(id);
    const proj = state.projects.find(p => p.id === id);
    if (proj) setOriginalStatus(proj.status);
  };

  // onDragOver: detect cross-column hover → update local state immediately for live preview
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeProjectId = active.id as string;
    const overId = over.id as string;

    const activeColumn = findColumnOfId(activeProjectId);
    const overColumn = findColumnOfId(overId);

    if (!activeColumn || !overColumn || activeColumn === overColumn) return;

    // Move the card to the new column immediately for visual feedback
    dispatch({
      type: 'UPDATE_PROJECT_STATUS',
      payload: {
        projectId: activeProjectId,
        newStatus: overColumn as Project['status'],
        userId: state.currentUser?.id || '',
      },
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const dragOriginalStatus = originalStatus; // captured before drop
    setActiveId(null);
    setOriginalStatus(null);
    if (!over) return;

    const projectId = active.id as string;
    const overId = over.id as string;

    const project = state.projects.find((p) => p.id === projectId);
    if (!project) return;

    // Determine target column
    const isColumn = allColumns.some(col => col.status === overId);
    const newStatus = isColumn
      ? overId
      : (state.projects.find(p => p.id === overId)?.status || project.status);

    // No actual column change — nothing to do
    if (newStatus === dragOriginalStatus) return;

    // Ensure local state reflects new column immediately
    if (project.status !== newStatus) {
      dispatch({
        type: 'UPDATE_PROJECT_STATUS',
        payload: {
          projectId,
          newStatus: newStatus as Project['status'],
          userId: state.currentUser?.id || '',
        },
      });
    }

    // ── Debounced save ── cancel any prior pending save for this card
    const existing = pendingSaves.current.get(projectId);
    if (existing) {
      clearTimeout(existing.timerId);
    }

    // Preserve the very first original status so we can revert all the way back
    const trueOriginal = existing?.savedFromStatus ?? dragOriginalStatus ?? project.status;

    const toastId = `move-${projectId}`;
    const targetLabel = allColumns.find(c => c.status === newStatus)?.label || newStatus;
    toast.dismiss(toastId);
    toast.info(`Moving card to "${targetLabel}" — saving in a moment...`, {
      id: toastId,
      duration: 1500,
    });

    const timerId = setTimeout(async () => {
      pendingSaves.current.delete(projectId);
      toast.dismiss(toastId);

      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({ message: 'Unknown error' }));
          throw new Error(errData.message || `HTTP ${response.status}`);
        }
      } catch (error: any) {
        console.error('Error saving card move:', error);
        toast.error(`Failed to save card move — reverting`);
        dispatch({
          type: 'UPDATE_PROJECT_STATUS',
          payload: {
            projectId,
            newStatus: trueOriginal as Project['status'],
            userId: state.currentUser?.id || '',
          },
        });
      }
    }, 1500);

    pendingSaves.current.set(projectId, { timerId, newStatus, savedFromStatus: trueOriginal });
  };

  const handleCardClick = (projectId: string) => {
    if (activeId) return; // Don't open modal if dragging
    const currentPath = window.location.pathname;
    router.push(`${currentPath}?project=${projectId}`);
  };

  const handleCloseProject = () => {
    setSelectedProjectId(null);
    const currentPath = window.location.pathname;
    router.push(currentPath, { scroll: false });
  };

  // Inline quick-add card handler
  const handleAddCard = async (name: string, status: string) => {
    if (!state.currentUser || !boardId) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name,
          boardId: boardId,
          status: status || 'todo',
          priority: 'MEDIUM',
          description: '',
        }),
      });
      const result = await response.json();
      if (result.success) {
        const p = result.data.project;
        dispatch({
          type: 'CREATE_PROJECT',
          payload: {
            project: {
              id: p.id,
              name,
              description: '',
              boardId: p.boardId || boardId,
              board: p.board ? { id: p.board.id, name: p.board.name } : undefined,
              status: p.status || status,
              priority: (p.priority || 'MEDIUM').toLowerCase(),
              dueDate: null,
              image: null,
              position: 0,
              assignments: [],
              labels: [],
              checklist: [],
              comments: [],
              attachments: [],
              activityLog: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            userId: state.currentUser.id,
          },
        });
        toast.success(`Card "${name}" added`);
      } else {
        toast.error(result.message || 'Failed to add card');
      }
    } catch (error) {
      console.error('Error adding card:', error);
      toast.error('Failed to add card');
    }
  };

  const selectedProject = state.projects.find((p) => p.id === selectedProjectId);

  const totalProjectCount = state.projects.filter((p) => !boardId || p.boardId === boardId).length;
  const isFiltered = searchQuery || filterPriority !== 'all' || filterAssignee !== 'all';

  return (
    <>
      {/* Search / filter feedback */}
      {isFiltered && (
        <div className="mb-4 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <span>
            Showing <span className="font-semibold text-zinc-700 dark:text-zinc-200">{filteredProjects.length}</span> of{' '}
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">{totalProjectCount}</span> projects
          </span>
          {filteredProjects.length === 0 && (
            <span className="text-amber-600 dark:text-amber-400">— No projects match your filters</span>
          )}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {allColumns.map((col) => (
              <Column
                key={col.status}
                status={col.status}
                label={col.label}
                color={col.color}
                projects={projectsByStatus[col.status] || []}
                onCardClick={handleCardClick}
                onAddCard={handleAddCard}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeProject ? (
            <div className="opacity-95 rotate-1 scale-105 shadow-2xl shadow-orange-500/30">
              <ProjectCard
                project={activeProject}
                onCardClick={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedProject && (
        <ProjectModal
          project={selectedProject}
          onClose={handleCloseProject}
        />

      )}
    </>
  );
}
