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
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-lg p-4 min-w-[320px] h-[calc(100vh-200px)] transition-colors ${
        isOver
          ? 'bg-orange-50 dark:bg-orange-500/10 border-2 border-dashed border-orange-400 dark:border-orange-500'
          : 'bg-gray-100 dark:bg-[#1a1f2e] dark:border dark:border-[#2d3548]'
      }`}
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
      <div className="flex-1 overflow-y-auto pr-1 space-y-3">
        <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3 min-h-[60px]">
            {projects.length === 0 ? (
              <div className={`flex flex-col items-center justify-center py-12 rounded-lg transition-colors ${
                isOver
                  ? 'text-orange-400 dark:text-orange-300'
                  : 'text-gray-400 dark:text-gray-500'
              }`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
                  isOver ? 'bg-orange-100 dark:bg-orange-500/20' : 'bg-gray-200 dark:bg-[#2d3548]'
                }`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-sm font-medium">{isOver ? 'Drop here' : 'No projects yet'}</p>
                {!isOver && <p className="text-xs mt-1">Drag a card here or create a new project</p>}
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
