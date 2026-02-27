'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/useApp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { dispatch } = useApp();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Use environment variable for API URL
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || 'Login failed. Please check your credentials.');
        setIsLoading(false);
        return;
      }

      // Store token in localStorage (ensure client-side)
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', data.data.token);
      }

      // Login successful
      dispatch({
        type: 'SET_USER',
        payload: {
          id: data.data.user.id,
          name: data.data.user.name,
          email: data.data.user.email,
          role: data.data.user.role, // Add role
        },
      });

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to connect to server. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-white">ProManage</CardTitle>
          <CardDescription className="text-white">Enterprise Project Management System</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className='text-white'>Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                }}
                className="border-gray-300 text-white placeholder:text-gray-400 focus:none"
                required
              />
              {/* <p className="text-xs text-gray-400 mt-1">
                Format: <span className="text-orange-400">role.username</span> (e.g., pm.azharrajput, tl.mustufa)
              </p> */}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className='text-white'>Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className="border-gray-300 text-white placeholder:text-gray-400 focus:none"
                required
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-md">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full bg-orange-500 hover:bg-[#047857] text-white" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
