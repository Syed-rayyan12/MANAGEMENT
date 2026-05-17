'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp, FolderOpen, CheckCircle, Globe, Users, Loader2 } from 'lucide-react';
import { adminAPI } from '@/lib/api-service';
import { KPIData } from '@/lib/types';
import { toast } from 'sonner';
import { KpiTile } from '@/components/shared/KpiTile';

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
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  if (!kpis) return null;

  const teamRevenues = kpis.revenueByTeam.map(t => ({
    name: t.name,
    revenue: t.totalRevenue,
  }));

  return (
    <div className="space-y-6">
      {/* KPI stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiTile
          label="Total Revenue"
          value={`£${kpis.totalRevenueAllTime.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`}
          accentColor="var(--accent)"
        />
        <KpiTile
          label="Revenue This Month"
          value={`£${kpis.totalRevenueThisMonth.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`}
          accentColor="var(--status-green)"
        />
        <KpiTile
          label="Active Projects"
          value={String(kpis.activeProjects)}
          accentColor="var(--status-blue)"
        />
        <KpiTile
          label="Completed Projects"
          value={String(kpis.completedProjects)}
          accentColor="var(--status-green)"
        />
        <KpiTile
          label="Live Projects"
          value={String(kpis.liveProjects)}
          accentColor="var(--status-violet)"
        />
        <KpiTile
          label="New Clients This Month"
          value={String(kpis.newClientsThisMonth)}
          accentColor="var(--status-amber)"
        />
        <KpiTile
          label="Active Assignments"
          value={String(kpis.activeAssignments)}
          accentColor="var(--status-blue)"
        />
        <KpiTile
          label="Completed This Month"
          value={String(kpis.completedAssignmentsThisMonth)}
          accentColor="var(--status-green)"
        />
      </div>

      {/* Bottom two-column breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Projects by Board */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <h3 className="text-[13px] font-semibold text-foreground mb-4">Projects by Board</h3>
          <div className="space-y-0">
            {kpis.projectsByBoard.map((board) => (
              <div key={board.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                <span className="text-[13px] text-fg-2">{board.name}</span>
                <span className="text-[13px] font-mono font-medium text-foreground">{board._count.projects}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue by Team */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <h3 className="text-[13px] font-semibold text-foreground mb-4">Revenue by Team</h3>
          <div className="space-y-0">
            {teamRevenues.map((t, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                <span className="text-[13px] text-fg-2">{t.name}</span>
                <span className="text-[13px] font-mono font-medium text-foreground">
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
