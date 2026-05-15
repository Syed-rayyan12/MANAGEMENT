'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Project, ProjectStatus } from '@/lib/types';
import { ProjectCard } from './Card';
import { Plus, X, MoreVertical, Trash2 } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ColumnProps {
  status: ProjectStatus | string;
  label: string;
  color: string;
  projects: Project[];
  onCardClick: (projectId: string) => void;
  onAddCard?: (name: string, status: string) => Promise<void>;
  onDeleteColumn?: (status: string, label: string, projectCount: number) => void;
}

export function Column({ status, label, color, projects, onCardClick, onAddCard, onDeleteColumn }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const { canCreateProject, canSoftDelete } = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [cardName, setCardName] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (showForm) inputRef.current?.focus();
  }, [showForm]);

  const handleSubmit = async () => {
    if (!cardName.trim() || saving) return;
    setSaving(true);
    await onAddCard?.(cardName.trim(), status as string);
    setCardName('');
    setSaving(false);
    setShowForm(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setCardName('');
      setShowForm(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl p-3 w-[300px] min-w-[300px] max-w-[300px] h-[calc(100vh-200px)] transition-colors ${
        isOver
          ? 'bg-orange-50/80 dark:bg-[#e05c29]/5 border-2 border-dashed border-[#e05c29]/30'
          : 'bg-zinc-100/70 dark:bg-zinc-900/40 border border-transparent'
      }`}
    >
      {/* Fixed Header */}
      <div className="mb-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
          <h3 className="font-semibold text-zinc-700 dark:text-zinc-300 text-sm">{label}</h3>
          <span className="bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 text-xs font-medium px-2 py-0.5 rounded-full">
            {projects.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {canSoftDelete && onDeleteColumn && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onDeleteColumn(status as string, label, projects.length)}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Column
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {canCreateProject && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
              title="Add a card"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Cards Container */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2">
        <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 min-h-[60px]">
            {projects.length === 0 && !showForm ? (
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
                {!isOver && <p className="text-xs mt-1">Drag a card here or use the + button</p>}
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

      {/* Inline Add Card Form */}
      {canCreateProject && (
        <div className="flex-shrink-0 mt-2">
          {showForm ? (
            <div className="space-y-2">
              <textarea
                ref={inputRef}
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter card title..."
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg border border-orange-500 bg-white dark:bg-[#232938] dark:text-white dark:placeholder-gray-500 focus:outline-none resize-none shadow-lg"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={!cardName.trim() || saving}
                  className="flex-1 py-1.5 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Adding...' : 'Add card'}
                </button>
                <button
                  onClick={() => { setCardName(''); setShowForm(false); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-200 dark:hover:bg-[#2d3548] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-500/10 transition-colors group"
            >
              <Plus className="w-4 h-4 group-hover:text-orange-500" />
              Add a card
            </button>
          )}
        </div>
      )}
    </div>
  );
}
