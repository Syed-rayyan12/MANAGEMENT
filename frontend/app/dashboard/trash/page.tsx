'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { trashAPI } from '@/lib/api-service';
import { TrashData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Trash2, RotateCcw, Loader2, Package, Columns3, FolderKanban, Clock } from 'lucide-react';

type Tab = 'boards' | 'columns' | 'projects';

export default function TrashPage() {
  const [data, setData] = useState<TrashData>({ boards: [], columns: [], projects: [] });
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('boards');

  const fetchTrash = async () => {
    try {
      const result = await trashAPI.getAll();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Error fetching trash:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTrash(); }, []);

  const handleRestore = async (type: 'board' | 'column' | 'project', id: string) => {
    setRestoringId(id);
    try {
      const result = await trashAPI.restore(type, id);
      if (result.success) {
        await fetchTrash();
      } else {
        toast.error(result.message || 'Failed to restore');
      }
    } catch (error) {
      console.error('Restore error:', error);
    } finally {
      setRestoringId(null);
    }
  };

  const totalCount = data.boards.length + data.columns.length + data.projects.length;

  const tabs: { key: Tab; label: string; count: number; icon: React.ElementType }[] = [
    { key: 'boards', label: 'Boards', count: data.boards.length, icon: FolderKanban },
    { key: 'columns', label: 'Columns', count: data.columns.length, icon: Columns3 },
    { key: 'projects', label: 'Projects', count: data.projects.length, icon: Package },
  ];

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
          <Trash2 className="w-5 h-5 text-red-500" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">Trash</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">
            {totalCount === 0 ? 'Trash is empty' : `${totalCount} items — auto-deleted after 30 days`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-accent text-accent'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key
                    ? 'bg-accent-soft text-accent'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      ) : (
        <div className="space-y-2">
          {activeTab === 'boards' && data.boards.map((board) => (
            <TrashRow
              key={board.id}
              name={board.name}
              subtitle={`${board._count.columns} columns, ${board._count.projects} projects`}
              deletedBy={board.deletedBy?.name || 'Unknown'}
              deletedAt={formatTimeAgo(board.deletedAt)}
              daysRemaining={board.daysRemaining}
              restoring={restoringId === board.id}
              onRestore={() => handleRestore('board', board.id)}
            />
          ))}

          {activeTab === 'columns' && data.columns.map((column) => (
            <TrashRow
              key={column.id}
              name={column.name}
              subtitle={`Board: ${column.board.name}`}
              deletedBy={column.deletedBy?.name || 'Unknown'}
              deletedAt={formatTimeAgo(column.deletedAt)}
              daysRemaining={column.daysRemaining}
              restoring={restoringId === column.id}
              onRestore={() => handleRestore('column', column.id)}
            />
          ))}

          {activeTab === 'projects' && data.projects.map((project) => (
            <TrashRow
              key={project.id}
              name={project.name}
              subtitle={`Board: ${project.board.name}`}
              deletedBy={project.deletedBy?.name || 'Unknown'}
              deletedAt={formatTimeAgo(project.deletedAt)}
              daysRemaining={project.daysRemaining}
              restoring={restoringId === project.id}
              onRestore={() => handleRestore('project', project.id)}
            />
          ))}

          {/* Empty state for active tab */}
          {((activeTab === 'boards' && data.boards.length === 0) ||
            (activeTab === 'columns' && data.columns.length === 0) ||
            (activeTab === 'projects' && data.projects.length === 0)) && (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
              <Trash2 className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">No deleted {activeTab}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TrashRow({
  name,
  subtitle,
  deletedBy,
  deletedAt,
  daysRemaining,
  restoring,
  onRestore,
}: {
  name: string;
  subtitle: string;
  deletedBy: string;
  deletedAt: string;
  daysRemaining: number;
  restoring: boolean;
  onRestore: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{name}</p>
        <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-6 ml-4">
        <div className="text-right hidden sm:block">
          <p className="text-xs text-zinc-500">Deleted by {deletedBy}</p>
          <p className="text-xs text-zinc-400">{deletedAt}</p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-amber-500">
          <Clock className="w-3.5 h-3.5" />
          <span>{daysRemaining}d left</span>
        </div>

        <Button
          onClick={onRestore}
          disabled={restoring}
          variant="outline"
          size="sm"
          className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
        >
          {restoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-1.5" />}
          Restore
        </Button>
      </div>
    </div>
  );
}
