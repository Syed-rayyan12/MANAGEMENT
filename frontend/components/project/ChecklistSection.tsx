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

interface ChecklistSectionProps {
  project: Project;
}

export function ChecklistSection({ project }: ChecklistSectionProps) {
  const { state, dispatch } = useApp();
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
    };
    const updatedChecklist = [...project.checklist, newItem];

    dispatch({
      type: 'UPDATE_CHECKLIST',
      payload: {
        projectId: project.id,
        checklist: updatedChecklist,
        userId: state.currentUser?.id || project.pm,
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
        userId: state.currentUser?.id || project.pm,
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
        userId: state.currentUser?.id || project.pm,
      },
    });

    await persistChecklist(updatedChecklist);
    toast.success('Checklist item removed');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-sm font-semibold dark:text-orange-400 flex items-center gap-2">
          <CheckSquare className="w-4 h-4" />
          Checklist
          {project.checklist.length > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
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
            <span className="text-xs font-medium text-gray-500 dark:text-orange-400 min-w-[36px] text-right">
              {checklistProgress}%
            </span>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {project.checklist.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-[#232938] group transition-colors"
          >
            <Checkbox
              checked={item.completed}
              onCheckedChange={() => handleToggleCheckItem(item.id)}
              className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
            />
            <span className={`flex-1 text-sm ${item.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
              {item.title}
            </span>
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
        <div className="text-center py-6 text-gray-400 dark:text-gray-500">
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
          <Button size="sm" onClick={handleAddCheckItem} className="bg-orange-500 hover:bg-orange-600 text-white">
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
