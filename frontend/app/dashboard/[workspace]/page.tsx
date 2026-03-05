'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Board } from '@/components/kanban/Board';
import { CreateProjectModal } from '@/components/project/CreateProjectModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Filter, SortAsc, ArrowLeft } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSearch } from '../layout';

export default function WorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { searchQuery } = useSearch();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [refreshKey, setRefreshKey] = useState(0);
  const [customColumns, setCustomColumns] = useState<any[]>([]);

  const workspace = params.workspace as string;
  const projectId = searchParams.get('project');

  // Load custom columns from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`kanban-columns-${workspace}`);
    if (stored) {
      try {
        setCustomColumns(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse custom columns:', e);
      }
    }
  }, [workspace]);

  const handleAddColumn = (columnName: string, columnColor: string) => {
    const newColumn = {
      status: columnName.toLowerCase().replace(/\s+/g, '-'),
      label: columnName,
      color: columnColor,
      isCustom: true
    };
    
    const updatedColumns = [...customColumns, newColumn];
    setCustomColumns(updatedColumns);
    localStorage.setItem(`kanban-columns-${workspace}`, JSON.stringify(updatedColumns));
    setRefreshKey(prev => prev + 1);
  };

  const workspaceNames: Record<string, string> = {
    'logo': 'Logo Design',
    'web-design': 'Web Design',
    'web-development': 'Web Development',
    'content': 'Content Creation'
  };

  const workspaceName = workspaceNames[workspace] || 'Workspace';

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
            <span className='text-white'>Back to Workspaces</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-orange-400">{workspaceName}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your {workspaceName.toLowerCase()} projects</p>
          </div>
        </div>
        <div className='flex items-center justify-between gap-5'>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2 text-white" />
                  <span className='text-white'>
                    Filter: {filterPriority === 'all' ? 'All' : filterPriority}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Filter by Priority</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFilterPriority('all')}>All Projects</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterPriority('critical')}>Critical</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterPriority('high')}>High</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterPriority('medium')}>Medium</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterPriority('low')}>Low</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <SortAsc className="w-4 h-4 mr-2 text-white" />
                  <span className='text-white'>
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
          <Button
            onClick={() => setShowAddColumnModal(true)}
            variant="outline"
            className="border-orange-500/50 hover:bg-orange-500/10 dark:border-orange-500/50 dark:hover:bg-orange-500/10"
          >
            <Plus className="w-4 h-4 mr-2 text-orange-500" />
            <span className='text-orange-500'>
              Add Column
            </span>
          </Button>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-orange-500 hover:bg-orange-600 dark:bg-orange-500 dark:hover:bg-orange-600 dark:shadow-lg dark:shadow-orange-500/50"
          >
            <Plus className="w-4 h-4 mr-2 text-white" />
            <span className='text-white'>
              New Project
            </span>
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div>
        <Board
          key={refreshKey}
          searchQuery={searchQuery}
          filterPriority={filterPriority}
          sortBy={sortBy}
          workspace={workspace}
          customColumns={customColumns}
        />
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal 
          onClose={() => {
            setShowCreateModal(false);
            setRefreshKey(prev => prev + 1);
          }} 
          initialWorkspace={workspace}
        />
      )}

      {/* Add Column Modal */}
      {showAddColumnModal && (
        <AddColumnModal 
          onClose={() => setShowAddColumnModal(false)}
          onAdd={handleAddColumn}
        />
      )}
    </div>
  );
}

function AddColumnModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, color: string) => void }) {
  const [columnName, setColumnName] = useState('');
  const [columnColor, setColumnColor] = useState('#3B82F6');

  const handleAddColumn = () => {
    if (!columnName.trim()) {
      alert('Column name is required');
      return;
    }
    
    onAdd(columnName.trim(), columnColor);
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md dark:bg-[#1a1f2e] dark:border-orange-500/30">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold dark:text-orange-400">Add New Column</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <Label htmlFor="columnName" className="dark:text-white">Column Name *</Label>
            <Input
              id="columnName"
              placeholder="Enter column name"
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
              className="mt-1 placeholder:text-gray-400"
            />
          </div>

          <div>
            <Label htmlFor="columnColor" className="dark:text-white">Column Color</Label>
            <div className="mt-2 flex gap-2">
              {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map((color) => (
                <button
                  key={color}
                  onClick={() => setColumnColor(color)}
                  className={`w-8 h-8 rounded-full border-2 ${
                    columnColor === color ? 'border-orange-500 scale-110' : 'border-gray-300'
                  } transition-all`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleAddColumn} className="flex-1 bg-orange-500 text-white hover:bg-orange-600">
              Add Column
            </Button>
            <Button onClick={onClose} variant="outline" className="flex-1 text-white">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
