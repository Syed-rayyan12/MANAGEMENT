'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useApp } from '@/contexts/useApp';
import { API_BASE_URL } from '@/lib/api-service';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, Settings, User, Moon, Sun, Menu } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { NotificationsPanel } from './NotificationsPanel';
import { useTheme } from 'next-themes';

interface TopbarProps {
  onMenuToggle?: () => void;
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { state, dispatch } = useApp();
  const { theme, setTheme } = useTheme();

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
        } catch (err) {
          // Ignore network errors for logout
        }
        localStorage.removeItem('token');
      }
    }
    dispatch({ type: 'LOGOUT' });
    router.push('/');
  };

  // Build breadcrumb from pathname
  const breadcrumbs = React.useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    const crumbs: { label: string; href: string }[] = [];
    if (parts.length > 0) {
      crumbs.push({ label: 'Studio', href: '/dashboard' });
    }
    if (parts.length > 1 && parts[1] !== 'dashboard') {
      const segment = parts[1];
      const label = segment
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      crumbs.push({ label, href: `/dashboard/${segment}` });
    }
    return crumbs;
  }, [pathname]);

  if (!state.currentUser) return null;

  return (
    <header className="sticky top-0 z-30 h-[52px] flex items-center justify-between px-5 bg-background/80 backdrop-blur-sm border-b border-border">
      {/* Left: Hamburger (mobile) + Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            aria-label="Toggle navigation menu"
            className="w-7 h-7 flex items-center justify-center rounded-md text-fg-2 hover:bg-surface-2 transition-colors duration-[120ms]"
          >
            <Menu className="w-[18px] h-[18px]" />
          </button>
        )}

        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 text-[13px] min-w-0">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={crumb.href}>
              {i > 0 && <span className="text-fg-4 mx-0.5">›</span>}
              <button
                onClick={() => router.push(crumb.href)}
                className={
                  i === breadcrumbs.length - 1
                    ? 'font-medium text-foreground truncate'
                    : 'text-fg-3 hover:text-foreground transition-colors truncate'
                }
              >
                {crumb.label}
              </button>
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-7 h-7 flex items-center justify-center rounded-md text-fg-3 hover:bg-surface-2 hover:text-foreground transition-colors duration-[120ms]"
        >
          {theme === 'dark' ? (
            <Sun className="w-[15px] h-[15px]" />
          ) : (
            <Moon className="w-[15px] h-[15px]" />
          )}
        </button>

        {/* Notifications */}
        <NotificationsPanel />

        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="Open profile menu" className="ml-1 rounded-full focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background">
              <Avatar className="w-7 h-7">
                <AvatarImage src={state.currentUser.avatar} alt={state.currentUser.name} />
                <AvatarFallback className="text-[11px] bg-accent-soft text-accent font-medium">
                  {state.currentUser.name.split(' ')[0][0]}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="flex flex-col">
              <span className="font-medium text-foreground text-[13px]">{state.currentUser.name}</span>
              <span className="text-[11px] text-fg-3">{state.currentUser.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 opacity-50 cursor-not-allowed" disabled>
              <User className="w-3.5 h-3.5" />
              <span className="text-[12px]">Profile <span className="text-[10px] text-fg-4">(Coming soon)</span></span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 opacity-50 cursor-not-allowed" disabled>
              <Settings className="w-3.5 h-3.5" />
              <span className="text-[12px]">Settings <span className="text-[10px] text-fg-4">(Coming soon)</span></span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="gap-2 text-destructive">
              <LogOut className="w-3.5 h-3.5" />
              <span className="text-[12px]">Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
