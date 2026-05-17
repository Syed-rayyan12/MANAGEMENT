'use client';
import { API_BASE_URL, boardAPI } from '@/lib/api-service';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DashboardSkeleton } from '@/components/ui/skeletons';
import { useApp } from '@/contexts/useApp';
import { Plus } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { BOARD_METADATA, DEFAULT_BOARD_METADATA } from '@/lib/constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { KpiTile } from '@/components/shared/KpiTile';

interface BoardCard {
  slug: string;
  name: string;
  projectCount: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { state, isLoading } = useApp();
  const [boards, setBoards] = useState<BoardCard[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [creating, setCreating] = useState(false);
  const [overview, setOverview] = useState<any>(null);

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
            for (const key of Object.keys(stats)) {
              const entry = stats[key];
              boardStats[key] = entry.count || 0;
            }
          }

          if (statsResult.success) {
            setOverview(statsResult.data);
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

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = state.currentUser?.name?.split(' ')[0] || '';
  const totalProjects = boards.reduce((sum, b) => sum + b.projectCount, 0);

  return (
    <ErrorBoundary>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[24px] font-semibold text-foreground tracking-[-0.02em]">
            {greeting}, {firstName}
          </h1>
          <p className="text-[13px] text-fg-3 mt-0.5">
            {totalProjects} active project{totalProjects !== 1 ? 's' : ''} across {boards.length} workspace{boards.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          variant="accent"
          onClick={() => setShowCreateWorkspace(true)}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          New workspace
        </Button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-3 max-[980px]:grid-cols-2">
        <KpiTile
          label="Active projects"
          value={String(totalProjects)}
          accentColor="var(--status-blue)"
        />
        <KpiTile
          label="Workspaces"
          value={String(boards.length)}
          accentColor="var(--ws-web-dev)"
        />
        <KpiTile
          label="Team members"
          value={String(overview?.teamCount || '—')}
          accentColor="var(--status-violet)"
        />
        <KpiTile
          label="Due this week"
          value={String(overview?.dueThisWeek || '—')}
          accentColor="var(--status-amber)"
        />
      </div>

      {/* Workspace Cards */}
      {boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-lg bg-accent-soft flex items-center justify-center mb-4">
            <Plus className="w-7 h-7 text-accent" />
          </div>
          <h2 className="text-[15px] font-semibold text-foreground mb-1">No workspaces yet</h2>
          <p className="text-[13px] text-fg-3 max-w-md">
            Workspaces will appear here once they are set up. Contact your team lead or administrator to get started.
          </p>
        </div>
      ) : (
        <div>
          <h2 className="text-kicker uppercase text-fg-4 tracking-widest mb-3">Workspaces</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {boards.map((board) => {
              const meta = BOARD_METADATA[board.slug] || DEFAULT_BOARD_METADATA;
              const Icon = meta.icon;
              return (
                <button
                  key={board.slug}
                  onClick={() => router.push(`/dashboard/${board.slug}`)}
                  className="group text-left rounded-lg border border-border bg-surface p-4 transition-colors duration-[120ms] hover:border-line-strong hover:bg-surface-2"
                >
                  {/* Icon tile */}
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center mb-3"
                    style={{ backgroundColor: `color-mix(in oklch, ${meta.accentColor} 15%, transparent)` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: meta.accentColor }} />
                  </div>

                  {/* Name + description */}
                  <h3 className="text-[13px] font-semibold text-foreground mb-0.5">{board.name}</h3>
                  <p className="text-[11px] text-fg-3 line-clamp-2 mb-3">{meta.description}</p>

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="font-mono font-medium text-fg-2">{board.projectCount}</span>
                    <span className="text-fg-4">projects</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Workspace Modal */}
      <Dialog open={showCreateWorkspace} onOpenChange={setShowCreateWorkspace}>
        <DialogContent className="max-w-md bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create New Workspace</DialogTitle>
            <DialogDescription className="sr-only">Create a new workspace board</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="workspaceName" className="text-[12px] font-medium text-fg-2">Workspace Name *</Label>
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
              <Button variant="ghost" onClick={() => { setShowCreateWorkspace(false); setNewWorkspaceName(''); }}>
                Cancel
              </Button>
              <Button
                variant="accent"
                onClick={handleCreateWorkspace}
                disabled={creating || !newWorkspaceName.trim()}
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
