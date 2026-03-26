
'use client';
import { API_BASE_URL, boardAPI } from '@/lib/api-service';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { Button } from '@/components/ui/button';
import { DashboardSkeleton } from '@/components/ui/skeletons';
import { useApp } from '@/contexts/useApp';
import { ArrowLeft } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { BOARD_METADATA, DEFAULT_BOARD_METADATA } from '@/lib/constants';

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-orange-400">Welcome to Your Workspace</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Select a workspace to manage your projects</p>
        </div>
      </div>

      {/* Board Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ">
        {boards.map((board) => {
          const meta = BOARD_METADATA[board.slug] || DEFAULT_BOARD_METADATA;
          const Icon = meta.icon;
          return (
            <button
              key={board.slug}
              onClick={() => router.push(`/dashboard/${board.slug}`)}
              className={`group relative rounded-2xl border-2 dark:border-orange-500/30 hover:border-transparent transition-all duration-300 hover:shadow-2xl hover:scale-105 overflow-hidden flex flex-col`}
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
                      <h3 className="text-xl font-bold text-gray-900 dark:text-orange-400  ">
                        {board.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 min-h-[40px]">
                        {meta.description}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-orange-500/20">
                      <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
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
    </div>
    </ErrorBoundary>
  );
}