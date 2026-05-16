'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useApp } from '@/contexts/useApp';
import { boardAPI } from '@/lib/api-service';
import {
  LayoutDashboard,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  User,
  FileText,
  Shield,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BOARD_METADATA, DEFAULT_BOARD_METADATA } from '@/lib/constants';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}


interface BoardItem {
  slug: string;
  name: string;
}

export function Sidebar({ collapsed, onToggle, isMobile = false, mobileOpen = false, onMobileClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { state } = useApp();
  const [boards, setBoards] = useState<BoardItem[]>([]);

  // Fetch all org-level boards
  useEffect(() => {
    if (!state.currentUser) return;
    const fetchBoards = async () => {
      try {
        const result = await boardAPI.getAll();
        if (result.success) {
          setBoards(
            result.data.boards.map((b: any) => ({
              slug: b.slug,
              name: b.name,
            }))
          );
        }
      } catch (error) {
        console.error('Error fetching boards:', error);
      }
    };
    fetchBoards();
  }, [state.currentUser]);

  const userRole = state.currentUser?.role;
  const canAccessInvoices = userRole === 'PM' || userRole === 'TL' || userRole === 'EXECUTIVE';
  const canAccessAdmin = userRole === 'EXECUTIVE';
  const canAccessPerformance = userRole === 'PRODUCTION';
  const canAccessTrash = userRole === 'PM' || userRole === 'PRODUCTION';

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
    ...(canAccessPerformance ? [{
      id: 'my-performance',
      label: 'My Performance',
      icon: TrendingUp,
      href: '/dashboard/my-performance',
      match: (p: string) => p === '/dashboard/my-performance',
    }] : []),
    ...(canAccessInvoices ? [{
      id: 'invoices',
      label: 'Invoices',
      icon: FileText,
      href: '/dashboard/invoices',
      match: (p: string) => p === '/dashboard/invoices',
    }] : []),
    ...(canAccessTrash ? [{
      id: 'trash',
      label: 'Trash',
      icon: Trash2,
      href: '/dashboard/trash',
      match: (p: string) => p === '/dashboard/trash',
    }] : []),
    ...(canAccessAdmin ? [{
      id: 'admin',
      label: 'Management',
      icon: Shield,
      href: '/dashboard/admin',
      match: (p: string) => p.startsWith('/dashboard/admin'),
    }] : []),
  ];

  return (
    <aside
      className={cn(
        'fixed left-0 top-16 h-[calc(100vh-4rem)] z-40 flex flex-col border-r transition-all duration-300 ease-in-out',
        'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800',
        isMobile
          ? cn('w-60', mobileOpen ? 'translate-x-0' : '-translate-x-full')
          : collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Toggle button — hidden on mobile where hamburger menu controls the drawer */}
      {!isMobile && (
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
      )}

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {/* Main nav */}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.match(pathname);
          return (
            <button
              key={item.id}
              onClick={() => { router.push(item.href); onMobileClose?.(); }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-gradient-to-r from-[#e05c29]/15 to-[#e05c29]/5 text-[#e05c29] border-l-2 border-[#e05c29] font-medium'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
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
          <div className="border-t border-zinc-200 dark:border-zinc-800" />
          {!collapsed && (
            <span className="block text-[10px] uppercase tracking-widest text-zinc-400 mt-3 mb-1 px-1">
              Boards
            </span>
          )}
        </div>

        {/* Dynamic board links */}
        {boards.map((board) => {
          const style = BOARD_METADATA[board.slug] || DEFAULT_BOARD_METADATA;
          const Icon = style.icon;
          const isActive = pathname === `/dashboard/${board.slug}`;
          return (
            <button
              key={board.slug}
              onClick={() => { router.push(`/dashboard/${board.slug}`); onMobileClose?.(); }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-gradient-to-r from-[#e05c29]/15 to-[#e05c29]/5 text-[#e05c29] border-l-2 border-[#e05c29] font-medium'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
              )}
              title={collapsed ? board.name : undefined}
            >
              <div
                className={cn(
                  'w-5 h-5 rounded flex items-center justify-center flex-shrink-0',
                  isActive
                    ? `bg-gradient-to-br ${style.sidebarGradient}`
                    : 'bg-gray-200 dark:bg-[#2d3548]'
                )}
              >
                <Icon className={cn('w-3 h-3', isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400')} />
              </div>
              {!collapsed && <span className="truncate">{board.name}</span>}
            </button>
          );
        })}
      </nav>

      {/* User info at bottom */}
      {state.currentUser && (
        <div className={cn(
          'border-t border-zinc-200 dark:border-zinc-800 p-3',
          collapsed ? 'flex justify-center' : ''
        )}>
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-orange-500" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {state.currentUser.name}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {state.currentUser.role}
                  {state.currentUser.teams && state.currentUser.teams.length > 0 && (
                    <span className="ml-1 text-orange-400 font-medium">
                      · {state.currentUser.teams.map(t => t.name).join(', ')}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
