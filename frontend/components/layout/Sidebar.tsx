'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useApp } from '@/contexts/useApp';
import { boardAPI } from '@/lib/api-service';
import {
  LayoutDashboard,
  Briefcase,
  Inbox,
  FileText,
  TrendingUp,
  Trash2,
  Shield,
  Search,
  User,
  ArrowDownToLine,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BOARD_METADATA, DEFAULT_BOARD_METADATA } from '@/lib/constants';

interface SidebarProps {
  isMobile?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface BoardItem {
  slug: string;
  name: string;
}

export function Sidebar({ isMobile = false, mobileOpen = false, onMobileClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { state } = useApp();
  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  // Fetch all org-level boards
  const fetchBoards = useCallback(async () => {
    if (!state.currentUser) return;
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
  }, [state.currentUser]);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  // Re-fetch boards when a workspace is created or deleted
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.added) {
        // Optimistically add the new board without waiting for API
        setBoards(prev => {
          if (prev.some(b => b.slug === detail.added.slug)) return prev;
          return [...prev, { slug: detail.added.slug, name: detail.added.name }];
        });
      } else if (detail?.removed) {
        setBoards(prev => prev.filter(b => b.slug !== detail.removed));
      } else {
        fetchBoards();
      }
    };
    window.addEventListener('boards-changed', handler);
    return () => window.removeEventListener('boards-changed', handler);
  }, [fetchBoards]);

  // Gmail-style hover: show sidebar when mouse enters trigger zone or sidebar itself
  const handleMouseEnter = useCallback(() => {
    if (isMobile) return;
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setIsVisible(true);
  }, [isMobile]);

  const handleMouseLeave = useCallback(() => {
    if (isMobile) return;
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 300);
  }, [isMobile]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

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
    {
      id: 'inbox',
      label: 'Inbox',
      icon: Inbox,
      href: '/dashboard/inbox',
      match: (p: string) => p === '/dashboard/inbox',
    },
    ...(canAccessInvoices ? [{
      id: 'invoices',
      label: 'Invoices',
      icon: FileText,
      href: '/dashboard/invoices',
      match: (p: string) => p === '/dashboard/invoices',
    }] : []),
    ...(canAccessAdmin ? [{
      id: 'insights',
      label: 'Insights',
      icon: TrendingUp,
      href: '/dashboard/insights',
      match: (p: string) => p.startsWith('/dashboard/insights') || p.startsWith('/dashboard/admin'),
    }] : []),
    ...(canAccessTrash ? [{
      id: 'trash',
      label: 'Trash',
      icon: Trash2,
      href: '/dashboard/trash',
      match: (p: string) => p === '/dashboard/trash',
    }] : []),
    ...(state.currentUser?.username === 'prod.tahiranwar' ? [{
      id: 'import',
      label: 'Trello Import',
      icon: ArrowDownToLine,
      href: '/dashboard/import',
      match: (p: string) => p === '/dashboard/import',
    }] : []),
  ];

  const navigate = (href: string) => {
    router.push(href);
    onMobileClose?.();
  };

  // Determine if sidebar should show
  const shouldShow = isMobile ? mobileOpen : isVisible;

  return (
    <>
      {/* Hover trigger zone — invisible strip on left edge (desktop only) */}
      {!isMobile && (
        <div
          className="fixed left-0 top-0 w-[40px] h-full z-40"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      )}

      {/* Mobile scrim overlay */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        ref={sidebarRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'fixed left-0 top-0 h-full z-50 flex flex-col w-[232px]',
          'bg-background border-r border-border',
          'transition-transform duration-[220ms] ease-out',
          shouldShow ? 'translate-x-0' : '-translate-x-full',
          shouldShow && !isMobile && 'shadow-3',
        )}
      >
        {/* Brand block */}
        <div className="px-4 pt-4 pb-2 flex justify-center">
          <img src="/logo-dark.png" alt="Xpert Web Studio" className="h-10 object-contain dark:hidden" />
          <img src="/logo-light.png" alt="Xpert Web Studio" className="h-10 object-contain hidden dark:block" />
        </div>

        {/* Search / Command Palette trigger */}
        <div className="px-3 py-2">
          <button
            aria-label="Open search (Cmd+K)"
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-surface text-fg-3 text-[12.5px] hover:bg-surface-2 transition-colors duration-[120ms]"
            onClick={() => {
              // Will wire to Command Palette in Phase 2
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
            }}
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="text-[10px] text-fg-4 font-mono bg-surface-2 px-1 py-0.5 rounded">⌘K</kbd>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.match(pathname);
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.href)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors duration-[120ms]',
                  isActive
                    ? 'bg-surface-3 text-foreground'
                    : 'text-fg-2 hover:bg-surface-2 hover:text-foreground'
                )}
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}

          {/* Workspaces section */}
          <div className="pt-4 pb-1 px-1">
            <span className="text-kicker uppercase text-fg-4 tracking-widest">
              Workspaces
            </span>
          </div>

          {boards.map((board) => {
            const style = BOARD_METADATA[board.slug] || DEFAULT_BOARD_METADATA;
            const Icon = style.icon;
            const isActive = pathname === `/dashboard/${board.slug}`;
            return (
              <button
                key={board.slug}
                onClick={() => navigate(`/dashboard/${board.slug}`)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors duration-[120ms]',
                  isActive
                    ? 'bg-surface-3 text-foreground'
                    : 'text-fg-2 hover:bg-surface-2 hover:text-foreground'
                )}
              >
                <div
                  className="w-[18px] h-[18px] rounded flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: style.accentColor, opacity: 0.15 }}
                >
                  <Icon className="w-3 h-3" style={{ color: style.accentColor }} />
                </div>
                <span className="truncate">{board.name}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: style.accentColor }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* User footer */}
        {state.currentUser && (
          <div className="border-t border-border px-3 py-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-accent-soft flex items-center justify-center flex-shrink-0">
                <User className="w-3.5 h-3.5 text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-foreground truncate">
                  {state.currentUser.name}
                </p>
                <p className="text-[11px] text-fg-3 truncate">
                  {state.currentUser.role}
                  {state.currentUser.teams && state.currentUser.teams.length > 0 && (
                    <span className="ml-1 text-fg-4">
                      · {state.currentUser.teams.map((t: any) => t.name).join(', ')}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
