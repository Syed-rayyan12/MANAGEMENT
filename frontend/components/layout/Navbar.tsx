'use client';
import { API_BASE_URL } from '@/lib/api-service';


import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/useApp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, LogOut, Settings, User, Moon, Sun, Menu } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { NotificationsPanel } from './NotificationsPanel';
import { useTheme } from 'next-themes';

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onMenuToggle?: () => void;
}

export function Navbar({ searchQuery, onSearchChange, onMenuToggle }: NavbarProps) {
  const router = useRouter();
  const { state, dispatch } = useApp();
  const { theme, setTheme } = useTheme();

  const handleLogout = async () => {
    // Optionally call backend logout endpoint
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

  if (!state.currentUser) return null;

  return (
    <header className="fixed top-0 left-0 right-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 z-50">
      <div className="flex items-center justify-between h-16 px-4 md:px-6 gap-2 md:gap-4">
        {/* Mobile menu + Logo */}
        <div className="flex items-center gap-2 min-w-fit">
          {onMenuToggle && (
            <Button variant="ghost" size="icon" onClick={onMenuToggle} className="md:hidden">
              <Menu className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            </Button>
          )}
          <div className="w-8 h-8 bg-gradient-to-br from-[#e05c29] to-orange-400 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-[0_4px_20px_rgba(224,92,41,0.35)]">
            X
          </div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 hidden sm:block">XRM</h1>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md hidden sm:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          {/* Dark Mode Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-gray-600" />
            ) : (
              <Moon className="w-5 h-5 text-gray-600" />
            )}
          </Button>

          {/* Notifications */}
          <NotificationsPanel />

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={state.currentUser.avatar} alt={state.currentUser.name} />
                  <AvatarFallback>{state.currentUser.name.split(' ')[0][0]}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{state.currentUser.name}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{state.currentUser.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 opacity-50 cursor-not-allowed" disabled>
                <User className="w-4 h-4 text-[#e05c29]" />
                <span className="text-zinc-700 dark:text-zinc-300 text-[12px]">Profile <span className="text-[10px] text-zinc-400">(Coming soon)</span></span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 opacity-50 cursor-not-allowed" disabled>
                <Settings className="w-4 h-4 text-[#e05c29]" />
                <span className="text-zinc-700 dark:text-zinc-300 text-[12px]">Settings <span className="text-[10px] text-zinc-400">(Coming soon)</span></span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="gap-2 text-red-600">
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
