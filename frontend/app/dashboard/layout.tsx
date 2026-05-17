'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/useApp';
import { Topbar } from '@/components/layout/Topbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (!token || !storedUser) {
        router.push('/');
        return;
      }

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

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-fg-3 text-[13px]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!state.currentUser) {
    return null;
  }

  return (
    <SearchContext.Provider value={{ searchQuery, setSearchQuery }}>
      <CommandPalette />

      {/* Gmail-style sidebar: overlays content, doesn't push it */}
      <Sidebar
        isMobile={isMobile}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Main content area — full width */}
      <div className="min-h-screen bg-background">
        <Topbar onMenuToggle={isMobile ? () => setMobileMenuOpen(prev => !prev) : undefined} />
        <main className="px-6 py-5 max-[980px]:px-4 max-[980px]:py-4 max-[600px]:px-3 max-[600px]:py-3">
          <ErrorBoundary context="page content">
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </SearchContext.Provider>
  );
}
