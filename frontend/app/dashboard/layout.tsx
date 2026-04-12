'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/useApp';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const SearchContext = createContext<{
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}>({
  searchQuery: '',
  setSearchQuery: () => {},
});

export function useSearch() {
  return useContext(SearchContext);
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { state, dispatch } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Persist sidebar state
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored === 'true') setSidebarCollapsed(true);
  }, []);

  const handleSidebarToggle = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    // Check authentication on mount
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (!token || !storedUser) {
        router.push('/');
        return;
      }

      // If user is not in state but exists in localStorage, restore it
      if (!state.currentUser && storedUser) {
        try {
          const user = JSON.parse(storedUser);
          dispatch({ type: 'SET_USER', payload: user });
        } catch (error) {
          console.error('Failed to parse stored user:', error);
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          router.push('/');
          return;
        }
      }

      setIsCheckingAuth(false);
    };

    checkAuth();
  }, []);

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#e05c29] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-900 dark:text-zinc-100">Loading...</p>
        </div>
      </div>
    );
  }

  if (!state.currentUser) {
    return null;
  }

  return (
    <SearchContext.Provider value={{ searchQuery, setSearchQuery }}>
      <Navbar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      <Sidebar collapsed={sidebarCollapsed} onToggle={handleSidebarToggle} />
      <main
        className={`min-h-screen relative transition-all duration-300 bg-zinc-50 dark:bg-zinc-950 ${sidebarCollapsed ? 'ml-16' : 'ml-60'}`}
      >
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
    </SearchContext.Provider>
  );
}
