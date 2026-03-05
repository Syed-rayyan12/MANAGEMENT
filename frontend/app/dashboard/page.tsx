
'use client';
import { API_BASE_URL } from '@/lib/api-service';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { Button } from '@/components/ui/button';
import { Plus, Filter, SortAsc, Sparkles, Code, Palette, FileText, ArrowLeft, Briefcase } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [workspaceStats, setWorkspaceStats] = useState({
    logoDesign: 0,
    webDesign: 0,
    webDevelopment: 0,
    contentWriter: 0
  });

  // Fetch dashboard stats on component mount
  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/dashboard/overview`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        setWorkspaceStats(result.data.workspaceStats);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const workspaces = [
    {
      id: 'logo',
      name: 'Logo Design',
      description: 'Brand identity, logos, and visual branding',
      icon: Sparkles,
      image: '/logo-section.png',
      gradient: 'from-purple-500 via-pink-500 to-rose-500',
      bgGradient: '',
      iconBg: '-designdark:border-orange-500/30 text-white',
      projectCount: workspaceStats.logoDesign
    },
    {
      id: 'web-design',
      name: 'Web Design',
      description: 'UI/UX design, mockups, and prototypes',
      icon: Palette,
      image: '/web-design.jpg',
      gradient: 'from-orange-500 via-amber-500 to-yellow-500',
      bgGradient: '',
      iconBg: 'dark:border-orange-500/30 text-white',
      projectCount: workspaceStats.webDesign
    },
    {
      id: 'web-development',
      name: 'Web Development',
      description: 'Frontend, backend, and full-stack development',
      icon: Code,
      image: '/web-development.jpg',
      gradient: 'from-blue-500 via-cyan-500 to-teal-500',
      bgGradient: '',
      iconBg: 'dark:border-orange-500/30 text-white',
      projectCount: workspaceStats.webDevelopment
    },
    {
      id: 'content',
      name: 'Content Creation',
      description: 'Copywriting, documentation, and media',
      icon: FileText,
      image: '/content-writer.jpg',
      gradient: 'from-green-500 via-orange-500 to-teal-500',
      bgGradient: '',
      iconBg: 'dark:border-orange-500/30 text-white',
      projectCount: workspaceStats.contentWriter
    }
  ];

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
        {workspaces.map((workspace) => {
          const Icon = workspace.icon;
          return (
            <button
              key={workspace.id}
              onClick={() => router.push(`/dashboard/${workspace.id}`)}
              className={`group relative rounded-2xl border-2 dark:border-orange-500/30 hover:border-transparent transition-all duration-300 hover:shadow-2xl hover:scale-105 overflow-hidden flex flex-col`}
            >
                  {/* Image at Top */}
                  <div className="relative w-full h-40 overflow-hidden">
                    <Image
                      src={workspace.image}
                      alt={workspace.name}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className={`absolute inset-0 bg-gradient-to-br ${workspace.gradient} opacity-20 group-hover:opacity-30 transition-opacity duration-300`}></div>
                  </div>

                  {/* Card Content */}
                  <div className="p-6 space-y-4 flex-1 flex flex-col">
                    {/* Icon */}
                    {/* <div className={`${workspace.iconBg} w-16 h-16 border border-orange-500/30 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div> */}

                    {/* Content */}
                    <div className="text-left space-y-2 flex-1">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-orange-400  ">
                        {workspace.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 min-h-[40px]">
                        {workspace.description}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-orange-500/20">
                      <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                        {workspace.projectCount} Projects
                      </span>
                      <div className={`w-8 h-8 rounded-full border border-orange-500/30 ${workspace.gradient} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <ArrowLeft className="w-4 h-4 text-white rotate-180" />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Stats Overview */}
          {/* <div className="mt-12">
            <h2 className="text-xl font-bold text-gray-900 dark:text-orange-400 mb-4">Overview</h2>
            <StatsCards />
          </div> */}
    </div>
  );
}