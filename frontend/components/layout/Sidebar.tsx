'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useApp } from '@/contexts/useApp';
import {
  LayoutDashboard,
  Briefcase,
  Sparkles,
  Palette,
  Code,
  FileText,
  ChevronLeft,
  ChevronRight,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const workspaces = [
  { id: 'logo', name: 'Logo Design', icon: Sparkles, gradient: 'from-purple-500 to-pink-500' },
  { id: 'web-design', name: 'Web Design', icon: Palette, gradient: 'from-orange-500 to-amber-500' },
  { id: 'web-development', name: 'Web Development', icon: Code, gradient: 'from-blue-500 to-cyan-500' },
  { id: 'content', name: 'Content Creation', icon: FileText, gradient: 'from-green-500 to-teal-500' },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { state } = useApp();

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      href: '/dashboard',
      match: (p: string) => p === '/dashboard',
    },
    {
      id: 'my-work',
      label: 'My Work',
      icon: Briefcase,
      href: '/dashboard/my-work',
      match: (p: string) => p === '/dashboard/my-work',
    },
  ];

  return (
    <aside
      className={cn(
        'fixed left-0 top-16 h-[calc(100vh-4rem)] z-40 flex flex-col border-r transition-all duration-300 ease-in-out',
        'bg-white dark:bg-[#0f1419] border-gray-200 dark:border-[#2d3548]',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-6 z-50 w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-lg hover:bg-orange-600 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {/* Main nav */}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.match(pathname);
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-orange-500/15 text-orange-500 dark:text-orange-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1a1f2e] hover:text-gray-900 dark:hover:text-white'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-orange-500')} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}

        {/* Divider */}
        <div className="my-3 mx-2">
          <div className="border-t border-gray-200 dark:border-[#2d3548]" />
          {!collapsed && (
            <span className="block text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mt-3 mb-1 px-1">
              Workspaces
            </span>
          )}
        </div>

        {/* Workspace links */}
        {workspaces.map((ws) => {
          const Icon = ws.icon;
          const isActive = pathname === `/dashboard/${ws.id}`;
          return (
            <button
              key={ws.id}
              onClick={() => router.push(`/dashboard/${ws.id}`)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-orange-500/15 text-orange-500 dark:text-orange-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1a1f2e] hover:text-gray-900 dark:hover:text-white'
              )}
              title={collapsed ? ws.name : undefined}
            >
              <div
                className={cn(
                  'w-5 h-5 rounded flex items-center justify-center flex-shrink-0',
                  isActive
                    ? `bg-gradient-to-br ${ws.gradient}`
                    : 'bg-gray-200 dark:bg-[#2d3548]'
                )}
              >
                <Icon className={cn('w-3 h-3', isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400')} />
              </div>
              {!collapsed && <span className="truncate">{ws.name}</span>}
            </button>
          );
        })}
      </nav>

      {/* User info at bottom */}
      {state.currentUser && (
        <div className={cn(
          'border-t border-gray-200 dark:border-[#2d3548] p-3',
          collapsed ? 'flex justify-center' : ''
        )}>
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-orange-500" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {state.currentUser.name}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {state.currentUser.role}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
