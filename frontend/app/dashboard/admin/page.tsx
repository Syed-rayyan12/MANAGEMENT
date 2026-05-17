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
          <Shield className="w-10 h-10 text-fg-4 mx-auto mb-3" />
          <p className="text-[13px] text-fg-3">You don&apos;t have access to this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-[24px] font-semibold text-foreground tracking-[-0.02em]">Insights</h1>
        <p className="text-[13px] text-fg-3 mt-0.5">
          Business overview and employee management
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1.5">
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
                'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-[120ms]',
                activeTab === tab.id
                  ? 'bg-surface-3 text-foreground'
                  : 'text-fg-3 hover:bg-surface-2 hover:text-foreground'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
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
