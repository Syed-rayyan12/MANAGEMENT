'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/useApp';
import { LoginForm } from '@/components/auth/LoginForm';

export default function Home() {
  const router = useRouter();
  const { state } = useApp();

  useEffect(() => {
    // If already logged in, redirect to dashboard
    if (state.currentUser) {
      router.replace('/dashboard');
    }
  }, [state.currentUser, router]);

  // Don't show login form if user is logged in (show loading state instead)
  if (state.currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return <LoginForm />;
}
