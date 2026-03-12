
'use client';
import { API_BASE_URL, teamAPI } from '@/lib/api-service';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { Button } from '@/components/ui/button';
import { DashboardSkeleton } from '@/components/ui/skeletons';
import { useApp } from '@/contexts/useApp';
import { Plus, Filter, SortAsc, Sparkles, Code, Palette, FileText, ArrowLeft, Briefcase, FolderKanban } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Icon + images lookup by team slug
const teamMeta: Record<string, { icon: LucideIcon; image: string; gradient: string; description: string }> = {
  'logo-design': {
    icon: Sparkles,
    image: '/logo-section.png',
    gradient: 'from-purple-500 via-pink-500 to-rose-500',
    description: 'Brand identity, logos, and visual branding',
  },
  'web-design': {
    icon: Palette,
    image: '/web-design.jpg',
    gradient: 'from-orange-500 via-amber-500 to-yellow-500',
    description: 'UI/UX design, mockups, and prototypes',
  },
  'web-development': {
    icon: Code,
    image: '/web-development.jpg',
    gradient: 'from-blue-500 via-cyan-500 to-teal-500',
    description: 'Frontend, backend, and full-stack development',
  },
  'content': {
    icon: FileText,
    image: '/content-writer.jpg',
    gradient: 'from-green-500 via-orange-500 to-teal-500',
    description: 'Copywriting, documentation, and media',
  },
};

const defaultMeta = {
  icon: FolderKanban,
  image: '/logo-section.png',
  gradient: 'from-gray-500 via-gray-600 to-gray-700',
  description: 'Manage projects in this workspace',
};

interface TeamCard {
  slug: string;
  name: string;
  projectCount: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { isLoading } = useApp();
  const [teams, setTeams] = useState<TeamCard[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  // Fetch teams + dashboard stats
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teamsResult, statsResult] = await Promise.all([
          teamAPI.getMyTeams(),
          (async () => {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/dashboard/overview`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.json();
          })(),
        ]);

        if (teamsResult.success) {
          const teamList = teamsResult.data.teams;
          const workspaceStats: Record<string, number> = {};
          
          if (statsResult.success && statsResult.data.workspaceStats) {
            for (const ws of statsResult.data.workspaceStats) {
              workspaceStats[ws.workspaceId] = ws.count;
            }
          }

          setTeams(
            teamList.map((t: any) => ({
              slug: t.slug,
              name: t.name,
              projectCount: t.workspace ? (workspaceStats[t.workspace.id] || 0) : 0,
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
    <div className="space-y-8 p-6">
      {/* Workspace Selection View */}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-orange-400">Welcome to Your Workspace</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Select a workspace to manage your projects</p>
        </div>
      </div>

      {/* Workspace Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ">
        {teams.map((team) => {
          const meta = teamMeta[team.slug] || defaultMeta;
          const Icon = meta.icon;
          return (
            <button
              key={team.slug}
              onClick={() => router.push(`/dashboard/${team.slug}`)}
              className={`group relative rounded-2xl border-2 dark:border-orange-500/30 hover:border-transparent transition-all duration-300 hover:shadow-2xl hover:scale-105 overflow-hidden flex flex-col`}
            >
                  {/* Image at Top */}
                  <div className="relative w-full h-40 overflow-hidden">
                    <Image
                      src={meta.image}
                      alt={team.name}
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
                        {team.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 min-h-[40px]">
                        {meta.description}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-orange-500/20">
                      <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                        {team.projectCount} Projects
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
  );
}