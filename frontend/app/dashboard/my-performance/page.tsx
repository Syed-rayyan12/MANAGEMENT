'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/contexts/useApp';
import { performanceAPI } from '@/lib/api-service';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface PerformanceData {
  user: { id: string; name: string; role: string; specialization?: string; avatar?: string };
  activeProjects: number;
  completedProjects: number;
  asPrimary: number;
  asCollaborator: number;
  projectsByBoard: { boardId: string; boardName: string; boardSlug: string; count: number }[];
  avgTurnaround: number;
  fastestTurnaround: number;
  slowestTurnaround: number;
  onTimeRate: number | null;
  onTimeCount: number;
  lateCount: number;
  withDueDateCount: number;
  totalRegressions: number;
  regressionsThisMonth: number;
  regressionRate: number;
  completionTrend: { month: string; count: number }[];
  recentCompletions: {
    projectId: string;
    projectName: string;
    board: string;
    boardSlug: string;
    assignedAt: string;
    completedAt: string | null;
    turnaroundDays: number | null;
    onTime: boolean | null;
  }[];
  recentRegressions: {
    projectId: string;
    projectName: string;
    causedBy: string;
    fromColumn: string;
    toColumn: string;
    createdAt: string;
  }[];
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold', color || 'text-zinc-900 dark:text-zinc-100')}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

export default function MyPerformancePage() {
  const { state } = useApp();
  const router = useRouter();
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (state.currentUser?.role !== 'PRODUCTION') {
      router.push('/dashboard');
      return;
    }
    performanceAPI.getMyPerformance().then(res => {
      if (res.success) setData(res.data.performance);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [state.currentUser, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-center text-zinc-500 mt-10">Failed to load performance data.</p>;
  }

  const onTimeColor = data.onTimeRate === null ? '' : data.onTimeRate >= 80 ? 'text-green-600' : data.onTimeRate >= 50 ? 'text-yellow-600' : 'text-red-600';
  const regressionColor = data.regressionsThisMonth === 0 ? 'text-green-600' : data.regressionsThisMonth <= 2 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">My Performance</h1>
        <p className="text-sm text-zinc-500 mt-1">Your work metrics and delivery stats</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="On-Time Rate"
          value={data.onTimeRate !== null ? `${data.onTimeRate}%` : 'N/A'}
          sub={data.withDueDateCount > 0 ? `${data.onTimeCount}/${data.withDueDateCount} with deadlines` : 'No deadlines set yet'}
          color={onTimeColor}
        />
        <StatCard
          label="Avg Turnaround"
          value={`${data.avgTurnaround}d`}
          sub={data.completedProjects > 0 ? `Range: ${data.fastestTurnaround}d - ${data.slowestTurnaround}d` : undefined}
        />
        <StatCard
          label="Regressions"
          value={String(data.regressionsThisMonth)}
          sub={`This month (${data.totalRegressions} total)`}
          color={regressionColor}
        />
        <StatCard
          label="Completed"
          value={String(data.completedProjects)}
          sub={`${data.activeProjects} active`}
        />
      </div>

      {/* Completion Trend */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">Completion Trend (Last 6 Months)</h2>
        <div className="flex items-end gap-2 h-32">
          {data.completionTrend.map(m => {
            const max = Math.max(...data.completionTrend.map(x => x.count), 1);
            const height = (m.count / max) * 100;
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{m.count}</span>
                <div
                  className="w-full rounded-t bg-orange-500 dark:bg-orange-400 min-h-[4px]"
                  style={{ height: `${height}%` }}
                />
                <span className="text-[10px] text-zinc-400">
                  {new Date(m.month + '-01').toLocaleDateString('en', { month: 'short' })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two-column: Recent Completions + Regressions */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Recent Completions</h2>
          {data.recentCompletions.length === 0 ? (
            <p className="text-xs text-zinc-400">No completions yet.</p>
          ) : (
            <div className="space-y-2">
              {data.recentCompletions.map(c => (
                <div key={c.projectId} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{c.projectName}</p>
                    <p className="text-xs text-zinc-500">{c.board}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {c.turnaroundDays !== null ? `${c.turnaroundDays}d` : '-'}
                    </p>
                    {c.onTime !== null && (
                      <span className={cn('text-xs', c.onTime ? 'text-green-600' : 'text-red-500')}>
                        {c.onTime ? 'On time' : 'Late'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Regressions</h2>
          {data.recentRegressions.length === 0 ? (
            <p className="text-xs text-zinc-400">No regressions. Great work!</p>
          ) : (
            <div className="space-y-2">
              {data.recentRegressions.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{r.projectName}</p>
                    <p className="text-xs text-zinc-500">
                      {r.fromColumn} → {r.toColumn} by {r.causedBy}
                    </p>
                  </div>
                  <p className="text-xs text-zinc-400">
                    {new Date(r.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Board Breakdown */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Projects by Board</h2>
        <div className="flex gap-4 flex-wrap">
          {data.projectsByBoard.map(b => (
            <div key={b.boardId} className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{b.boardName}</p>
              <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{b.count}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
