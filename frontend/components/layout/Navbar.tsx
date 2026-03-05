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
import { Search, LogOut, Settings, User, Moon, Sun } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { NotificationsPanel } from './NotificationsPanel';
import { useTheme } from 'next-themes';

interface NavbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function Navbar({ searchQuery, onSearchChange }: NavbarProps) {
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
    <header className="bg-white dark:bg-[#0f1419] dark:border-[#2d3548] border-b border-gray-200 sticky top-0 z-50 dark:shadow-lg dark:shadow-orange-500/5">
      <div className="flex items-center justify-between h-16 px-6 gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 min-w-fit">
          <div className="w-8 h-8 bg-orange-500 dark:bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-lg dark:shadow-orange-500/50">
            P
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-orange-400">ProManage</h1>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 bg-gray-50 dark:bg-[#1a1f2e] dark:border-[#2d3548] dark:text-orange-400 dark:placeholder-orange-500/50 border-gray-300 dark:focus:border-orange-500"
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
                <span className="font-semibold text-white">{state.currentUser.name}</span>
                <span className="text-xs text-white">{state.currentUser.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 hover:bg-[#1a1f2e]">
                <User className="w-4 h-4 text-orange-500 " />
                <span className='text-white text-[12px]'>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 hover:bg-[#1a1f2e]">
                <Settings className="w-4 h-4 text-orange-500 " />
                <span className='text-white text-[12px]'>Settings</span>
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
