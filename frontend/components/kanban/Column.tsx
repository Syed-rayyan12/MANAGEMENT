'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Project, ProjectStatus } from '@/lib/types';
import { ProjectCard } from './Card';
import { Plus, X, MoreVertical, Trash2, Pencil } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useIsMobile } from '@/hooks/use-mobile';
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
  onEditColumn?: (status: string, label: string, color: string, phase: string) => void;
  boardColumns?: { status: string; label: string; color: string; phase?: string }[];
}

export function Column({ status, label, color, projects, onCardClick, onAddCard, onDeleteColumn, onEditColumn, boardColumns }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const { canCreateProject, canSoftDelete } = usePermissions();
  const isMobile = useIsMobile();
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
      className={`flex flex-col rounded-lg p-3 ${
        isMobile ? 'w-[86vw] min-w-[86vw] max-w-[320px] snap-start' : 'w-[296px] min-w-[296px] max-w-[296px]'
      } h-[calc(100vh-200px)] transition-colors duration-[120ms] ${
        isOver
          ? 'border-2 border-accent bg-accent-soft'
          : 'bg-surface-2 border border-border'
      }`}
    >
      {/* Column Header */}
      <div className="mb-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="text-[12.5px] font-semibold text-foreground">{label}</h3>
          <span className="text-[11px] font-mono font-medium text-fg-3 bg-surface-3 px-1.5 py-0.5 rounded">
            {projects.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {(onEditColumn || (canSoftDelete && onDeleteColumn)) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button aria-label="Column options" className="w-7 h-7 rounded-md flex items-center justify-center text-fg-3 hover:text-foreground hover:bg-surface-3 transition-colors duration-[120ms]">
                  <MoreVertical className="w-[15px] h-[15px]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEditColumn && (
                  <DropdownMenuItem
                    onClick={() => {
                      const col = boardColumns?.find(c => c.status === status);
                      onEditColumn(status as string, label, color, col?.phase || 'NOT_STARTED');
                    }}
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit Column
                  </DropdownMenuItem>
                )}
                {canSoftDelete && onDeleteColumn && (
                  <DropdownMenuItem
                    onClick={() => onDeleteColumn(status as string, label, projects.length)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Column
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {canCreateProject && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="w-7 h-7 rounded-md flex items-center justify-center text-fg-3 hover:text-foreground hover:bg-surface-3 transition-colors duration-[120ms]"
              aria-label="Add a card"
              title="Add a card"
            >
              <Plus className="w-[15px] h-[15px]" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Cards */}
      <div className="flex-1 overflow-y-auto pr-0.5 space-y-1.5">
        <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5 min-h-[60px]">
            {projects.length === 0 && !showForm ? (
              <div className={`flex flex-col items-center justify-center py-10 rounded-md text-center ${
                isOver ? 'text-accent bg-accent-soft/50' : 'text-fg-4'
              }`}>
                {isOver ? (
                  <p className="text-[12px] font-medium">Drop here</p>
                ) : (
                  <>
                    <div className="w-9 h-9 rounded-lg bg-surface-3 flex items-center justify-center mb-2">
                      <Plus className="w-4 h-4 text-fg-4" />
                    </div>
                    <p className="text-[12px] font-medium">No projects yet</p>
                    <p className="text-[11px] mt-0.5">Drag a card here or click + to add one</p>
                  </>
                )}
              </div>
            ) : (
              projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onCardClick={onCardClick}
                  boardColumns={boardColumns}
                />
              ))
            )}
          </div>
        </SortableContext>
      </div>

      {/* Add Card Form */}
      {canCreateProject && (
        <div className="flex-shrink-0 mt-2">
          {showForm ? (
            <div className="space-y-1.5">
              <textarea
                ref={inputRef}
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter card title..."
                rows={2}
                className="w-full px-2.5 py-2 text-[13px] rounded-md border border-accent-line bg-surface text-foreground placeholder:text-fg-4 focus:outline-none focus:ring-2 focus:ring-accent-soft resize-none"
              />
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleSubmit}
                  disabled={!cardName.trim() || saving}
                  className="flex-1 py-1.5 text-[12px] font-medium rounded-md bg-accent text-accent-fg hover:brightness-105 disabled:opacity-50 transition-all duration-[120ms]"
                >
                  {saving ? 'Adding...' : 'Add card'}
                </button>
                <button
                  onClick={() => { setCardName(''); setShowForm(false); }}
                  aria-label="Cancel adding card"
                  className="w-7 h-7 flex items-center justify-center rounded-md text-fg-3 hover:text-foreground hover:bg-surface-3 transition-colors duration-[120ms]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-fg-3 border border-dashed border-border hover:border-line-strong hover:text-foreground transition-colors duration-[120ms]"
            >
              <Plus className="w-3.5 h-3.5" />
              Add a card
            </button>
          )}
        </div>
      )}
    </div>
  );
}
