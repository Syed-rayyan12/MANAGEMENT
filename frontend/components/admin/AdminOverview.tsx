'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp, FolderOpen, CheckCircle, Globe, Users, Loader2 } from 'lucide-react';
import { adminAPI } from '@/lib/api-service';
import { KPIData } from '@/lib/types';
import { toast } from 'sonner';

export function AdminOverview() {
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKPIs = async () => {
      try {
        const result = await adminAPI.getKPIs();
        if (result.success) {
          setKpis(result.data.kpis);
        } else {
          toast.error(result.message || 'Failed to load KPIs');
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to load KPIs');
      } finally {
        setLoading(false);
      }
    };
    fetchKPIs();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#e05c29]" />
      </div>
    );
  }

  if (!kpis) return null;

  // Compute revenue by team totals
  const teamRevenues = kpis.revenueByTeam.map(t => ({
    name: t.name,
    revenue: t.invoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0),
  }));

  return (
    <div className="space-y-6">
      {/* KPI stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Total Revenue"
          value={`£${kpis.totalRevenueAllTime.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`}
          gradient="from-[#e05c29] to-amber-400"
          icon={TrendingUp}
        />
        <StatCard
          label="Revenue This Month"
          value={`£${kpis.totalRevenueThisMonth.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`}
          gradient="from-emerald-400 to-emerald-300"
          icon={TrendingUp}
        />
        <StatCard
          label="Active Projects"
          value={String(kpis.activeProjects)}
          gradient="from-blue-400 to-blue-300"
          icon={FolderOpen}
        />
        <StatCard
          label="Completed Projects"
          value={String(kpis.completedProjects)}
          gradient="from-emerald-500 to-emerald-400"
          icon={CheckCircle}
        />
        <StatCard
          label="Live Projects"
          value={String(kpis.liveProjects)}
          gradient="from-purple-400 to-purple-300"
          icon={Globe}
        />
        <StatCard
          label="New Clients This Month"
          value={String(kpis.newClientsThisMonth)}
          gradient="from-amber-400 to-amber-300"
          icon={Users}
        />
      </div>

      {/* Bottom two-column breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Projects by Board */}
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Projects by Board</h3>
          <div className="space-y-2">
            {kpis.projectsByBoard.map((board) => (
              <div key={board.id} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">{board.name}</span>
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{board._count.projects}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue by Team */}
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Revenue by Team</h3>
          <div className="space-y-2">
            {teamRevenues.map((t, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">{t.name}</span>
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  £{t.revenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────

function StatCard({
  label,
  value,
  gradient,
  icon: Icon,
}: {
  label: string;
  value: string;
  gradient: string;
  icon: React.ElementType;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-sm">
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${gradient}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
        </div>
        <Icon className="w-5 h-5 text-zinc-300 dark:text-zinc-600 mt-0.5" />
      </div>
    </div>
  );
}
