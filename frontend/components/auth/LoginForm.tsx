'use client';

import React, { useState } from 'react';
import { API_BASE_URL } from '@/lib/api-service';
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

      if (typeof window !== 'undefined') {
        localStorage.setItem('token', data.data.token);
      }

      dispatch({
        type: 'SET_USER',
        payload: {
          id: data.data.user.id,
          username: data.data.user.username,
          name: data.data.user.name,
          email: data.data.user.email,
          role: data.data.user.role,
          teams: data.data.user.teams || [],
        },
      });

      router.push('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to connect to server. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 w-10 h-10 rounded-lg bg-foreground flex items-center justify-center ring-1 ring-accent/30">
            <span className="text-background font-bold text-lg">X</span>
          </div>
          <CardTitle className="text-[24px] tracking-[-0.02em]">XRM</CardTitle>
          <CardDescription>Enterprise Project Management System</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-[12px] font-medium text-fg-2">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                }}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[12px] font-medium text-fg-2">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                required
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-status-red text-[12px] bg-status-red-soft p-2.5 rounded-md">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <Button type="submit" variant="accent" className="w-full" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
