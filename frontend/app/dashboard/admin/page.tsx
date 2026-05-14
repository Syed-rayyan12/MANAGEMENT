'use client';

import React, { useState } from 'react';
import { Shield, BarChart3, Users } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { AdminOverview } from '@/components/admin/AdminOverview';
import { AdminEmployees } from '@/components/admin/AdminEmployees';

type AdminTab = 'overview' | 'employees';

export default function AdminPage() {
  const { canAccessAdmin } = usePermissions();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  if (!canAccessAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Shield className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-500 dark:text-zinc-400">You don&apos;t have access to this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Management</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Business overview and employee management
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-2">
        {([
          { id: 'overview' as AdminTab, label: 'Overview', icon: BarChart3 },
          { id: 'employees' as AdminTab, label: 'Employees', icon: Users },
        ] as const).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-[#e05c29]/15 text-[#e05c29]'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' ? <AdminOverview /> : <AdminEmployees />}
    </div>
  );
}
