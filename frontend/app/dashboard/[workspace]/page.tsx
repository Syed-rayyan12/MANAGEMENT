'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Board } from '@/components/kanban/Board';
import { CreateProjectModal } from '@/components/project/CreateProjectModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BoardSkeleton } from '@/components/ui/skeletons';
import { useApp } from '@/contexts/useApp';
import { boardAPI } from '@/lib/api-service';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Filter, SortAsc, ArrowLeft, Users, X } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSearch } from '../layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function WorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { searchQuery } = useSearch();
  const { isLoading, getAllUsers, getUserName } = useApp();
  const { canCreateProject, canAddColumn } = usePermissions();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [refreshKey, setRefreshKey] = useState(0);
  const [customColumns, setCustomColumns] = useState<any[]>([]);
  const [boardName, setBoardName] = useState<string>('');
  const [boardId, setBoardId] = useState<string | null>(null);

  const boardSlug = params.workspace as string;
  const projectId = searchParams.get('project');
  const [boardLoading, setBoardLoading] = useState(true);

  // Fetch board by slug to get board info + columns
  useEffect(() => {
    setBoardLoading(true);
    setBoardId(null);
    const fetchBoard = async () => {
      try {
        const result = await boardAPI.getBySlug(boardSlug);
        if (result.success) {
          const board = result.data.board;
          setBoardName(board.name);
          setBoardId(board.id);
          // Use board columns from API if available
          if (board.columns && board.columns.length > 0) {
            const cols = board.columns
              .sort((a: any, b: any) => a.position - b.position)
              .map((c: any) => ({
                status: c.key,
                label: c.name,
                color: c.color,
                isCustom: false,
              }));
            setCustomColumns(cols);
          }
        }
      } catch (error) {
        console.error('Error fetching board:', error);
      } finally {
        setBoardLoading(false);
      }
    };
    fetchBoard();
  }, [boardSlug]);

  const handleAddColumn = (columnName: string, columnColor: string) => {
    const newColumn = {
      status: columnName.toLowerCase().replace(/\s+/g, '-'),
      label: columnName,
      color: columnColor,
      isCustom: true
    };
    
    const updatedColumns = [...customColumns, newColumn];
    setCustomColumns(updatedColumns);
    setRefreshKey(prev => prev + 1);
  };

  const displayName = boardName || boardSlug;

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900 dark:text-zinc-100">{displayName}</h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">Manage your {displayName.toLowerCase()} projects</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2 text-zinc-600 dark:text-zinc-400" />
                  <span className="text-zinc-700 dark:text-zinc-300">
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
                  <SortAsc className="w-4 h-4 mr-2 text-zinc-600 dark:text-zinc-400" />
                  <span className="text-zinc-700 dark:text-zinc-300">
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Users className="w-4 h-4 mr-2 text-zinc-600 dark:text-zinc-400" />
                  <span className="text-zinc-700 dark:text-zinc-300">
                    Assignee: {filterAssignee === 'all' ? 'All' : getUserName(filterAssignee)}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-64 overflow-y-auto">
                <DropdownMenuLabel>Filter by Assignee</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFilterAssignee('all')}>All Members</DropdownMenuItem>
                {getAllUsers().map((user) => (
                  <DropdownMenuItem key={user.id} onClick={() => setFilterAssignee(user.id)}>
                    {user.name}
                    {user.role && (
                      <span className="ml-2 text-xs text-gray-400">({user.role})</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {canAddColumn && (
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
          )}
          {canCreateProject && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-orange-500 hover:bg-orange-600 dark:bg-orange-500 dark:hover:bg-orange-600 dark:shadow-lg dark:shadow-orange-500/50"
            >
              <Plus className="w-4 h-4 mr-2 text-white" />
              <span className='text-white'>
                New Project
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* Active Filters */}
      {(filterPriority !== 'all' || filterAssignee !== 'all' || searchQuery) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-400">Active filters:</span>
          {searchQuery && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30">
              Search: &quot;{searchQuery}&quot;
            </span>
          )}
          {filterPriority !== 'all' && (
            <button
              onClick={() => setFilterPriority('all')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30 hover:bg-orange-500/25 transition-colors"
            >
              Priority: {filterPriority}
              <X className="w-3 h-3" />
            </button>
          )}
          {filterAssignee !== 'all' && (
            <button
              onClick={() => setFilterAssignee('all')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30 hover:bg-orange-500/25 transition-colors"
            >
              Assignee: {getUserName(filterAssignee)}
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => { setFilterPriority('all'); setFilterAssignee('all'); }}
            className="text-xs text-gray-500 hover:text-orange-400 transition-colors underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Kanban Board */}
      <div>
        {isLoading || boardLoading ? (
          <BoardSkeleton />
        ) : (
          <ErrorBoundary>
            <Board
              key={`${boardSlug}-${refreshKey}`}
              searchQuery={searchQuery}
              filterPriority={filterPriority}
              filterAssignee={filterAssignee}
              sortBy={sortBy}
              boardId={boardId}
              customColumns={customColumns}
            />
          </ErrorBoundary>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal 
          onClose={() => {
            setShowCreateModal(false);
            setRefreshKey(prev => prev + 1);
          }} 
          initialBoard={boardId}
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
      <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Add New Column</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <Label htmlFor="columnName" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Column Name *</Label>
            <Input
              id="columnName"
              placeholder="Enter column name"
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
              className="mt-1 placeholder:text-gray-400"
            />
          </div>

          <div>
            <Label htmlFor="columnColor" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Column Color</Label>
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
            <Button onClick={handleAddColumn} className="flex-1 text-white bg-gradient-to-r from-[#e05c29] to-orange-400 hover:to-rose-500 shadow-[0_4px_20px_rgba(224,92,41,0.35)]">
              Add Column
            </Button>
            <Button onClick={onClose} variant="outline" className="flex-1 text-zinc-700 dark:text-zinc-300">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
