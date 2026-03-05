'use client';

import React, { useMemo } from 'react';
import { useApp } from '@/contexts/useApp';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Project } from '@/lib/types';
import { Folder, AlertCircle, Code, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';

function calculateStats(projects: Project[], userId: string) {
  const userProjects = projects.filter((p) => p.pm === userId);

  const totalProjects = userProjects.length;

  const overdueProjects = userProjects.filter(
    (p) => p.dueDate && new Date(p.dueDate) < new Date() && p.status !== 'Completed'
  ).length;

  const inDevelopment = userProjects.filter((p) => p.status === 'in-progress').length;

  const inProduction = userProjects.filter((p) => p.status === 'Completed').length;

  const completedThisWeek = userProjects.filter((p) => {
    if (p.status !== 'Completed') return false;
    const updateDate = new Date(p.updatedAt);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return updateDate > weekAgo;
  }).length;

  const highPriorityProjects = userProjects.filter(
    (p) => (p.priority === 'high' || p.priority === 'critical') && p.status !== 'Completed'
  ).length;

  return {
    totalProjects,
    overdueProjects,
    inDevelopment,
    inProduction,
    completedThisWeek,
    highPriorityProjects,
  };
}

export function StatsCards() {
  const { state } = useApp();

  const stats = useMemo(
    () => (state.currentUser ? calculateStats(state.projects, state.currentUser.id) : null),
    [state.projects, state.currentUser]
  );

  if (!stats) return null;

  const statItems = [
    {
      title: 'Total Projects',
      value: stats.totalProjects,
      icon: Folder,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Overdue',
      value: stats.overdueProjects,
      icon: AlertCircle,
      color: 'bg-red-100 text-red-600',
    },
    {
      title: 'In Development',
      value: stats.inDevelopment,
      icon: Code,
      color: 'bg-purple-100 text-purple-600',
    },
    {
      title: 'In Production',
      value: stats.inProduction,
      icon: Zap,
      color: 'bg-green-100 text-green-600',
    },
    {
      title: 'Completed This Week',
      value: stats.completedThisWeek,
      icon: CheckCircle2,
      color: 'bg-orange-100 text-orange-600',
    },
    {
      title: 'High Priority',
      value: stats.highPriorityProjects,
      icon: AlertTriangle,
      color: 'bg-orange-100 text-orange-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {statItems.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.title} className="hover:shadow-md dark:hover:shadow-orange-500/20 transition-shadow dark:bg-[#1a1f2e] dark:border-[#2d3548]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700 dark:text-orange-400">{item.title}</CardTitle>
              <div className={`p-2 rounded-lg ${item.color} dark:bg-orange-500/20 dark:text-orange-400`}>
                <Icon className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-orange-400">{item.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
