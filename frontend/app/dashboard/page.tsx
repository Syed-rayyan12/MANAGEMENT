
'use client';
import { API_BASE_URL, boardAPI } from '@/lib/api-service';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DashboardSkeleton } from '@/components/ui/skeletons';
import { useApp } from '@/contexts/useApp';
import { ArrowLeft, Plus } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { BOARD_METADATA, DEFAULT_BOARD_METADATA } from '@/lib/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface BoardCard {
  slug: string;
  name: string;
  projectCount: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { isLoading } = useApp();
  const [boards, setBoards] = useState<BoardCard[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [creating, setCreating] = useState(false);

  // Fetch boards + dashboard stats
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [boardsResult, statsResult] = await Promise.all([
          boardAPI.getAll(),
          (async () => {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/dashboard/overview`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.json();
          })(),
        ]);

        if (boardsResult.success) {
          const boardList = boardsResult.data.boards;
          const boardStats: Record<string, number> = {};
          
          if (statsResult.success && statsResult.data.boardStats) {
            const stats = statsResult.data.boardStats;
            // Backend returns { slug: { name, slug, count } } object
            for (const key of Object.keys(stats)) {
              const entry = stats[key];
              boardStats[key] = entry.count || 0;
            }
          }

          setBoards(
            boardList.map((b: any) => ({
              slug: b.slug,
              name: b.name,
              projectCount: boardStats[b.slug] || 0,
            }))
          );
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
      setStatsLoading(false);
    };
    fetchData();
  }, []);

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    setCreating(true);
    try {
      const result = await boardAPI.create(newWorkspaceName.trim());
      if (result.success) {
        const board = result.data.board;
        setBoards(prev => [...prev, { slug: board.slug, name: board.name, projectCount: 0 }]);
        toast.success('Workspace created');
        setShowCreateWorkspace(false);
        setNewWorkspaceName('');
        router.push(`/dashboard/${board.slug}`);
      } else {
        toast.error(result.message || 'Failed to create workspace');
      }
    } catch (error) {
      toast.error('Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  if (isLoading || statsLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <ErrorBoundary>
    <div className="space-y-8 p-6">
      {/* Workspace Selection View */}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">Welcome to Your Workspace</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">Select a workspace to manage your projects</p>
        </div>
        <Button
          onClick={() => setShowCreateWorkspace(true)}
          className="bg-gradient-to-r from-[#e05c29] to-orange-400 hover:to-rose-500 text-white shadow-[0_4px_20px_rgba(224,92,41,0.35)]"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Workspace
        </Button>
      </div>

      {/* Board Cards Grid */}
      {boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center mb-6">
            <ArrowLeft className="w-10 h-10 text-orange-500/40 rotate-180" />
          </div>
          <h2 className="text-xl font-semibold text-zinc-700 dark:text-zinc-300 mb-2">No workspaces yet</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md">
            Workspaces will appear here once they are set up. Contact your team lead or administrator to get started.
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ">
        {boards.map((board) => {
          const meta = BOARD_METADATA[board.slug] || DEFAULT_BOARD_METADATA;
          const Icon = meta.icon;
          return (
            <button
              key={board.slug}
              onClick={() => router.push(`/dashboard/${board.slug}`)}
              className="group relative rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-transparent bg-white dark:bg-zinc-900 transition-all duration-300 hover:shadow-2xl hover:scale-105 overflow-hidden flex flex-col"
            >
                  {/* Image at Top */}
                  <div className="relative w-full h-40 overflow-hidden">
                    <Image
                      src={meta.image}
                      alt={board.name}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} opacity-20 group-hover:opacity-30 transition-opacity duration-300`}></div>
                  </div>

                  {/* Card Content */}
                  <div className="p-6 space-y-4 flex-1 flex flex-col">
                    {/* Content */}
                    <div className="text-left space-y-2 flex-1">
                      <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                        {board.name}
                      </h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 min-h-[40px]">
                        {meta.description}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
                      <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                        {board.projectCount} Projects
                      </span>
                      <div className={`w-8 h-8 rounded-full border border-orange-500/30 ${meta.gradient} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <ArrowLeft className="w-4 h-4 text-white rotate-180" />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
      )}
      {/* Create Workspace Modal */}
      <Dialog open={showCreateWorkspace} onOpenChange={setShowCreateWorkspace}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
            <DialogDescription className="sr-only">Create a new workspace board</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="workspaceName" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Workspace Name *</Label>
              <Input
                id="workspaceName"
                placeholder="e.g. Video Editing, SEO, Marketing"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateWorkspace()}
                autoFocus
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowCreateWorkspace(false); setNewWorkspaceName(''); }}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateWorkspace}
                disabled={creating || !newWorkspaceName.trim()}
                className="bg-gradient-to-r from-[#e05c29] to-orange-400 hover:to-rose-500 text-white"
              >
                {creating ? 'Creating...' : 'Create Workspace'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </ErrorBoundary>
  );
}