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
import { boardAPI, trashAPI } from '@/lib/api-service';
import { DeleteConfirmation } from '@/components/shared/DeleteConfirmation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Filter, SortAsc, ArrowLeft, Users, X, Trash2 } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useSocket } from '@/contexts/SocketContext';
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
  const { canCreateProject, canAddColumn, canSoftDelete } = usePermissions();
  const { socket } = useSocket();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [refreshKey, setRefreshKey] = useState(0);
  const [customColumns, setCustomColumns] = useState<any[]>([]);
  const [boardName, setBoardName] = useState<string>('');
  const [boardId, setBoardId] = useState<string | null>(null);
  const [boardData, setBoardData] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'board' | 'column'; id: string; name: string; projectCount: number; columnCount?: number } | null>(null);

  const boardSlug = params.workspace as string;
  const projectId = searchParams.get('project');
  const [boardLoading, setBoardLoading] = useState(true);

  // Join/leave board room for real-time events
  useEffect(() => {
    if (!socket || !boardSlug) return;
    socket.emit('join:board', boardSlug);
    return () => {
      socket.emit('leave:board', boardSlug);
    };
  }, [socket, boardSlug]);

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
          setBoardData(board);
          // Use board columns from API if available
          if (board.columns && board.columns.length > 0) {
            const cols = board.columns
              .sort((a: any, b: any) => a.position - b.position)
              .map((c: any) => ({
                status: c.key,
                label: c.name,
                color: c.color,
                isCustom: false,
                phase: c.phase || 'NOT_STARTED',
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

  const handleAddColumn = async (columnName: string, columnColor: string, columnPhase: string) => {
    const newColumn = {
      status: columnName.toLowerCase().replace(/\s+/g, '-'),
      label: columnName,
      color: columnColor,
      isCustom: true,
      phase: columnPhase,
    };

    const updatedColumns = [...customColumns, newColumn];
    setCustomColumns(updatedColumns);
    setRefreshKey(prev => prev + 1);

    if (boardId) {
      try {
        await boardAPI.addColumn(boardId, columnName, columnColor, columnPhase);
      } catch (error) {
        console.error('Error saving column:', error);
      }
    }
  };

  const handleSoftDelete = async () => {
    if (!deleteTarget || !boardId) return;
    try {
      if (deleteTarget.type === 'board') {
        await trashAPI.softDeleteBoard(boardId);
        router.push('/dashboard');
      } else {
        await trashAPI.softDeleteColumn(boardId, deleteTarget.id);
        const result = await boardAPI.getBySlug(boardSlug);
        if (result.success) {
          const board = result.data.board;
          setBoardData(board);
          const cols = board.columns
            .sort((a: any, b: any) => a.position - b.position)
            .map((c: any) => ({
              status: c.key,
              label: c.name,
              color: c.color,
              isCustom: false,
              phase: c.phase || 'NOT_STARTED',
            }));
          setCustomColumns(cols);
          setRefreshKey(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleDeleteColumn = (status: string, label: string, projectCount: number) => {
    const col = boardData?.columns?.find((c: any) => c.key === status);
    if (col) {
      setDeleteTarget({ type: 'column', id: col.id, name: label, projectCount });
    }
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
        <div className="flex flex-wrap items-center gap-2 md:gap-5 w-full md:w-auto">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
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
          {canSoftDelete && (
            <Button
              onClick={() => setDeleteTarget({
                type: 'board',
                id: boardId || '',
                name: displayName,
                projectCount: 0,
                columnCount: customColumns.length,
              })}
              variant="outline"
              className="border-red-500/30 hover:bg-red-500/10 text-red-500 hover:text-red-600 w-full sm:w-auto"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Workspace
            </Button>
          )}
          {canAddColumn && (
            <Button
              onClick={() => setShowAddColumnModal(true)}
              variant="outline"
              className="border-accent hover:bg-accent-soft w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2 text-accent" />
              <span className='text-accent'>
                Add Column
              </span>
            </Button>
          )}
          {canCreateProject && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-accent hover:bg-accent/90 text-accent-fg w-full sm:w-auto"
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
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent-soft text-accent border border-accent-line">
              Search: &quot;{searchQuery}&quot;
            </span>
          )}
          {filterPriority !== 'all' && (
            <button
              onClick={() => setFilterPriority('all')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent-soft text-accent border border-accent-line hover:bg-accent-soft/80 transition-colors"
            >
              Priority: {filterPriority}
              <X className="w-3 h-3" />
            </button>
          )}
          {filterAssignee !== 'all' && (
            <button
              onClick={() => setFilterAssignee('all')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent-soft text-accent border border-accent-line hover:bg-accent-soft/80 transition-colors"
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
              onDeleteColumn={canSoftDelete ? handleDeleteColumn : undefined}
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

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <DeleteConfirmation
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleSoftDelete}
          title={`Delete ${deleteTarget.type === 'board' ? 'Workspace' : 'Column'}?`}
          description={`This will delete "${deleteTarget.name}" and move it to trash.`}
          impactSummary={
            deleteTarget.type === 'board'
              ? `This will delete <strong>${deleteTarget.name}</strong> along with <strong>${deleteTarget.columnCount || 0} columns</strong> and <strong>${deleteTarget.projectCount} projects</strong>.`
              : `This will delete column <strong>${deleteTarget.name}</strong> and <strong>${deleteTarget.projectCount} projects</strong> in it.`
          }
        />
      )}
    </div>
  );
}

function AddColumnModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, color: string, phase: string) => void }) {
  const [columnName, setColumnName] = useState('');
  const [columnColor, setColumnColor] = useState('#3B82F6');
  const [columnPhase, setColumnPhase] = useState('IN_PROGRESS');

  const handleAddColumn = () => {
    if (!columnName.trim()) {
      alert('Column name is required');
      return;
    }
    onAdd(columnName.trim(), columnColor, columnPhase);
    onClose();
  };

  const phases = [
    { value: 'NOT_STARTED', label: 'Not Started', description: 'Work hasn\'t begun yet', color: 'text-zinc-500' },
    { value: 'IN_PROGRESS', label: 'In Progress', description: 'Actively being worked on', color: 'text-blue-500' },
    { value: 'DONE', label: 'Done', description: 'Work is complete', color: 'text-emerald-500' },
    { value: 'ON_HOLD', label: 'On Hold', description: 'Paused or blocked', color: 'text-amber-500' },
  ];

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
            <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Phase *</Label>
            <p className="text-xs text-zinc-400 mt-0.5 mb-2">How this column appears in the cross-board &quot;My Work&quot; view</p>
            <div className="grid grid-cols-2 gap-2">
              {phases.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setColumnPhase(p.value)}
                  className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                    columnPhase === p.value
                      ? 'border-accent bg-accent-soft'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <span className={`text-sm font-medium ${p.color}`}>{p.label}</span>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{p.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="columnColor" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Column Color</Label>
            <div className="mt-2 flex gap-2">
              {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map((color) => (
                <button
                  key={color}
                  onClick={() => setColumnColor(color)}
                  className={`w-8 h-8 rounded-full border-2 ${
                    columnColor === color ? 'border-accent scale-110' : 'border-gray-300'
                  } transition-all`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleAddColumn} variant="accent" className="flex-1">
              Add Column
            </Button>
            <Button onClick={onClose} variant="ghost" className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
