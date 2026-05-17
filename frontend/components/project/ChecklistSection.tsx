'use client';

import React, { useState } from 'react';
import { Project } from '@/lib/types';
import { projectAPI } from '@/lib/api-service';
import { toast } from 'sonner';
import { useApp } from '@/contexts/useApp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Plus, X, CheckSquare } from 'lucide-react';
import { format } from 'date-fns';

interface ChecklistSectionProps {
  project: Project;
}

export function ChecklistSection({ project }: ChecklistSectionProps) {
  const { state, dispatch, getUserName } = useApp();
  const [newCheckItemTitle, setNewCheckItemTitle] = useState('');
  const [showAddCheckItem, setShowAddCheckItem] = useState(false);

  const checklistProgress = project.checklist.length > 0
    ? Math.round((project.checklist.filter(i => i.completed).length / project.checklist.length) * 100)
    : 0;

  const persistChecklist = async (items: typeof project.checklist) => {
    try {
      await projectAPI.updateChecklist(
        project.id,
        items.map((item, idx) => ({
          title: item.title,
          completed: item.completed,
          position: idx,
          createdBy: item.createdBy || undefined,
          createdAt: item.createdAt || undefined,
        }))
      );
    } catch (error) {
      console.error('Error updating checklist:', error);
      toast.error('Failed to save checklist');
    }
  };

  const handleAddCheckItem = async () => {
    if (!newCheckItemTitle.trim()) return;
    const newItem = {
      id: `temp_${Date.now()}`,
      title: newCheckItemTitle.trim(),
      completed: false,
      createdBy: state.currentUser?.id || '',
      createdAt: new Date(),
    };
    const updatedChecklist = [...project.checklist, newItem];

    dispatch({
      type: 'UPDATE_CHECKLIST',
      payload: {
        projectId: project.id,
        checklist: updatedChecklist,
        userId: state.currentUser?.id || '',
      },
    });

    setNewCheckItemTitle('');
    await persistChecklist(updatedChecklist);
    toast.success('Checklist item added');
  };

  const handleToggleCheckItem = async (itemId: string) => {
    const updatedChecklist = project.checklist.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );

    dispatch({
      type: 'UPDATE_CHECKLIST',
      payload: {
        projectId: project.id,
        checklist: updatedChecklist,
        userId: state.currentUser?.id || '',
      },
    });

    await persistChecklist(updatedChecklist);
  };

  const handleDeleteCheckItem = async (itemId: string) => {
    const updatedChecklist = project.checklist.filter(item => item.id !== itemId);

    dispatch({
      type: 'UPDATE_CHECKLIST',
      payload: {
        projectId: project.id,
        checklist: updatedChecklist,
        userId: state.currentUser?.id || '',
      },
    });

    await persistChecklist(updatedChecklist);
    toast.success('Checklist item removed');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CheckSquare className="w-4 h-4" />
          Checklist
          {project.checklist.length > 0 && (
            <span className="text-xs text-fg-3">
              ({project.checklist.filter(i => i.completed).length}/{project.checklist.length})
            </span>
          )}
        </Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAddCheckItem(!showAddCheckItem)}
          className="h-7 text-xs"
        >
          <Plus className="w-3 h-3 mr-1" /> Add Item
        </Button>
      </div>

      {project.checklist.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <Progress value={checklistProgress} className="flex-1 h-2" />
            <span className="text-xs font-medium text-fg-3 min-w-[36px] text-right">
              {checklistProgress}%
            </span>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {project.checklist.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-2 group transition-colors"
          >
            <Checkbox
              checked={item.completed}
              onCheckedChange={() => handleToggleCheckItem(item.id)}
              className="data-[state=checked]:bg-accent data-[state=checked]:border-accent"
            />
            <div className="flex-1 min-w-0">
              <span className={`text-sm ${item.completed ? 'line-through text-fg-4' : 'text-foreground'}`}>
                {item.title}
              </span>
              {(item.createdBy || item.createdAt) && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  {item.createdBy && (
                    <span className="w-4 h-4 rounded-full bg-accent-soft text-accent text-[8px] font-bold flex items-center justify-center flex-shrink-0">
                      {getUserName(item.createdBy)[0]}
                    </span>
                  )}
                  {item.createdAt && (
                    <span className="text-[10px] text-fg-4">
                      {format(new Date(item.createdAt), 'MMM d')}
                    </span>
                  )}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteCheckItem(item.id)}
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 transition-opacity"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>

      {project.checklist.length === 0 && !showAddCheckItem && (
        <div className="text-center py-6 text-fg-4">
          <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No checklist items</p>
          <p className="text-xs mt-1">Break down this project into smaller tasks</p>
        </div>
      )}

      {showAddCheckItem && (
        <div className="flex items-center gap-2 mt-2">
          <Input
            placeholder="Add a checklist item..."
            value={newCheckItemTitle}
            onChange={(e) => setNewCheckItemTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddCheckItem(); }}
            autoFocus
            className="flex-1"
          />
          <Button size="sm" onClick={handleAddCheckItem} className="bg-accent hover:bg-accent/90 text-accent-fg">
            Add
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setShowAddCheckItem(false); setNewCheckItemTitle(''); }}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
