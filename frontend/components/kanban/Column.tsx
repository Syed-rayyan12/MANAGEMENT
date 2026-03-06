'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Project, ProjectStatus } from '@/lib/types';
import { ProjectCard } from './Card';
import { Plus, X } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

interface ColumnProps {
  status: ProjectStatus | string;
  label: string;
  color: string;
  projects: Project[];
  onCardClick: (projectId: string) => void;
  onAddCard?: (name: string, status: string) => Promise<void>;
}

export function Column({ status, label, color, projects, onCardClick, onAddCard }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const { canCreateProject } = usePermissions();
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

      {/* Scrollable Cards Container */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3">
        <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3 min-h-[60px]">
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
