'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/useApp';
import { Navbar } from '@/components/layout/Navbar';

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
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
      <main 
        className="min-h-screen relative"
        style={{
          backgroundImage: `linear-gradient(rgba(26, 31, 46, 0.92), rgba(0, 0, 0, 0.92)), url('https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&q=80')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)'
        }}
      >
        <div className="absolute inset-0 backdrop-blur-sm pointer-events-none"></div>
        <div className="relative z-10">
          {children}
        </div>
      </main>
    </SearchContext.Provider>
  );
}
