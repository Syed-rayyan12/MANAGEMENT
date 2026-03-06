

'use client';
import { API_BASE_URL } from '@/lib/api-service';
import { toast } from 'sonner';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { Project } from '@/lib/types';
import { DEFAULT_KANBAN_COLUMNS } from '@/lib/constants';
import { useApp } from '@/contexts/useApp';
import { Column } from './Column';
import { ProjectModal } from '../project/ProjectModal';

interface BoardProps {
  searchQuery?: string;
  filterPriority?: string;
  filterAssignee?: string;
  sortBy?: string;
  workspace?: string | null;
  customColumns?: any[];
}

export function Board({ searchQuery = '', filterPriority = 'all', filterAssignee = 'all', sortBy = 'date', workspace = null, customColumns = [] }: BoardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get('project');
  
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projectIdFromUrl);
  const { state, dispatch } = useApp();

  // Update selected project when URL changes
  useEffect(() => {
    setSelectedProjectId(projectIdFromUrl);
  }, [projectIdFromUrl]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 18,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Merge default and custom columns
  const allColumns = [...DEFAULT_KANBAN_COLUMNS, ...customColumns];

  // Filter projects by current user, search, priority, and workspace
  const filteredProjects = useMemo(() => {
    return state.projects.filter((p) => {
      // Show all projects regardless of PM (changed from: p.pm === state.currentUser?.id)
      const isUserProject = true;
      
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           p.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPriority = filterPriority === 'all' || p.priority === filterPriority;
      const matchesAssignee = filterAssignee === 'all' || p.developer === filterAssignee || p.pm === filterAssignee;
      const matchesWorkspace = !workspace || p.workspace === workspace;

      return isUserProject && matchesSearch && matchesPriority && matchesAssignee && matchesWorkspace;
    });
  }, [state.projects, state.currentUser?.id, searchQuery, filterPriority, filterAssignee, workspace]);

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
      // Default: sort by position
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const projectId = active.id as string;
    const overId = over.id as string;

    const project = state.projects.find((p) => p.id === projectId);
    if (!project) return;

    // Determine if dropped on a column (status) or on another card
    const isColumn = allColumns.some(col => col.status === overId);
    const newStatus = isColumn ? overId : (state.projects.find(p => p.id === overId)?.status || project.status);

    if (project.status !== newStatus) {
      // Cross-column move
      dispatch({
        type: 'UPDATE_PROJECT_STATUS',
        payload: {
          projectId,
          newStatus: newStatus as Project['status'],
          userId: state.currentUser?.id || '',
        },
      });

      // Persist status + position
      try {
        const token = localStorage.getItem('token');
        const statusMap: Record<string, string> = {
          'Todo': 'TODO',
          'in-progress': 'IN_PROGRESS',
          'Completed': 'COMPLETED',
          'Revisons': 'REVISIONS'
        };

        await fetch(`${API_BASE_URL}/projects/${projectId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            status: statusMap[newStatus] || newStatus
          })
        });
      } catch (error) {
        console.error('Error updating project status:', error);
        toast.error('Failed to update status — reverting');
        dispatch({
          type: 'UPDATE_PROJECT_STATUS',
          payload: {
            projectId,
            newStatus: project.status,
            userId: state.currentUser?.id || '',
          },
        });
      }
    }
  };

  const handleCardClick = (projectId: string) => {
    const currentPath = window.location.pathname;
    router.push(`${currentPath}?project=${projectId}`);
  };

  const handleCloseProject = () => {
    const currentPath = window.location.pathname;
    router.push(currentPath);
  };

  const selectedProject = state.projects.find((p) => p.id === selectedProjectId);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
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
              />
            ))}
          </div>
        </div>
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
