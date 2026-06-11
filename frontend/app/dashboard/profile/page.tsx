'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/contexts/useApp';
import { authAPI } from '@/lib/api-service';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileInfoForm } from '@/components/profile/ProfileInfoForm';
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm';
import { PreferencesTab } from '@/components/profile/PreferencesTab';
import { Loader2 } from 'lucide-react';

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, dispatch } = useApp();
  const user = state.currentUser;

  const tab = searchParams.get('tab') === 'preferences' ? 'preferences' : 'profile';

  // Hydrate avatar/specialization from the server — the localStorage copy of
  // currentUser may predate these fields being included in the login response.
  useEffect(() => {
    if (!user) return;
    authAPI
      .getMe()
      .then((res) => {
        if (!res.success || !res.data?.user) return;
        const fresh = res.data.user;
        const changed =
          fresh.name !== user.name ||
          fresh.email !== user.email ||
          (fresh.avatar || undefined) !== user.avatar ||
          (fresh.specialization || undefined) !== user.specialization;
        if (changed) {
          dispatch({
            type: 'SET_USER',
            payload: {
              ...user,
              name: fresh.name,
              email: fresh.email,
              avatar: fresh.avatar || undefined,
              specialization: fresh.specialization || undefined,
            },
          });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto p-5 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">My Account</h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          Manage your profile and preferences.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) =>
          router.replace(value === 'preferences' ? '/dashboard/profile?tab=preferences' : '/dashboard/profile')
        }
      >
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-4 space-y-6">
          <ProfileInfoForm />
          <ChangePasswordForm />
        </TabsContent>
        <TabsContent value="preferences" className="mt-4">
          <PreferencesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
