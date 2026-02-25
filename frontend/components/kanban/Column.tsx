'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Project, ProjectStatus } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { ProjectCard } from './Card';

interface ColumnProps {
  status: ProjectStatus | string;
  label: string;
  color: string;
  projects: Project[];
  onCardClick: (projectId: string) => void;
}

export function Column({ status, label, color, projects, onCardClick }: ColumnProps) {
  const { setNodeRef } = useDroppable({
    id: status,
  });

  return (
    <div
      className="flex flex-col bg-gray-100 dark:bg-[#1a1f2e] dark:border dark:border-[#2d3548] rounded-lg p-4 min-w-[320px] h-[calc(100vh-200px)]"
    >
      {/* Fixed Header */}
      <div className="mb-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
          <h3 className="font-semibold text-gray-900 dark:text-orange-400">{label}</h3>
          <span className="bg-gray-300 dark:bg-orange-500/20 text-gray-700 dark:text-orange-400 text-xs font-medium px-2 py-1 rounded-full border dark:border-orange-500/30">
            {projects.length}
          </span>
        </div>
      </div>

      {/* Scrollable Cards Container */}
      <div 
        ref={setNodeRef}
        className="flex-1 overflow-y-auto pr-1 space-y-3"
      >
        <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {projects.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <p className="text-sm">No projects</p>
              </div>
            ) : (
              projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onCardClick={onCardClick}
                />
              ))
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}
