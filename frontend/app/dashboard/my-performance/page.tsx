'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/useApp';
import { performanceAPI } from '@/lib/api-service';
import { cn } from '@/lib/utils';
import { Loader2, TrendingUp, Clock, RotateCcw, CheckCircle2 } from 'lucide-react';

interface CompletionEntry {
  projectName: string;
  boardName: string;
  turnaroundDays: number | null;
  onTime: boolean | null;
  completedAt: string;
}

interface RegressionEntry {
  projectName: string;
  fromColumn: string;
  toColumn: string;
  causedBy: string;
  date: string;
}

interface MonthlyTrend {
  month: string;
  count: number;
}

interface BoardBreakdown {
  boardName: string;
  count: number;
}

interface PerformanceData {
  onTimeRate: number | null;
  avgTurnaroundDays: number | null;
  regressionsThisMonth: number;
  completedCount: number;
  activeCount: number;
  completionTrend: MonthlyTrend[];
  recentCompletions: CompletionEntry[];
  regressions: RegressionEntry[];
  boardBreakdown: BoardBreakdown[];
}

export default function MyPerformancePage() {
  const router = useRouter();
  const { state } = useApp();
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userRole = state.currentUser?.role;

  // Guard: redirect non-PRODUCTION users
  useEffect(() => {
    if (state.currentUser && userRole !== 'PRODUCTION') {
      router.replace('/dashboard');
    }
  }, [state.currentUser, userRole, router]);

  // Fetch performance data
  useEffect(() => {
    if (!state.currentUser || userRole !== 'PRODUCTION') return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await performanceAPI.getMyPerformance();
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.message || 'Failed to load performance data');
        }
      } catch (err) {
        setError('Failed to load performance data');
        console.error('Performance fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [state.currentUser, userRole]);

  // Loading state
  if (loading || !state.currentUser) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  // Non-PRODUCTION guard (in case redirect hasn't happened yet)
  if (userRole !== 'PRODUCTION') {
    return null;
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <p className="text-zinc-500 dark:text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const maxTrend = Math.max(...data.completionTrend.map((t) => t.count), 1);

  const onTimeRateColor =
    data.onTimeRate === null
      ? 'text-zinc-400'
      : data.onTimeRate >= 80
        ? 'text-emerald-500'
        : data.onTimeRate >= 50
          ? 'text-amber-500'
          : 'text-red-500';

  const regressionColor =
    data.regressionsThisMonth === 0
      ? 'text-emerald-500'
      : data.regressionsThisMonth <= 2
        ? 'text-amber-500'
        : 'text-red-500';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">My Performance</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Your productivity metrics and project history
        </p>
      </div>

      {/* Top stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* On-Time Rate */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-zinc-400" />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">On-Time Rate</span>
          </div>
          <p className={cn('text-3xl font-bold', onTimeRateColor)}>
            {data.onTimeRate === null ? 'N/A' : `${Math.round(data.onTimeRate)}%`}
          </p>
        </div>

        {/* Avg Turnaround */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-zinc-400" />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Avg Turnaround</span>
          </div>
          <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {data.avgTurnaroundDays !== null ? `${data.avgTurnaroundDays}d` : 'N/A'}
          </p>
        </div>

        {/* Regressions This Month */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <div className="flex items-center gap-2 mb-2">
            <RotateCcw className="w-4 h-4 text-zinc-400" />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Regressions This Month</span>
          </div>
          <p className={cn('text-3xl font-bold', regressionColor)}>
            {data.regressionsThisMonth}
          </p>
        </div>

        {/* Completed */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-zinc-400" />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Completed</span>
          </div>
          <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {data.completedCount}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {data.activeCount} active
          </p>
        </div>
      </div>

      {/* Completion Trend */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Completion Trend</h2>
        <div className="flex items-end gap-3 h-48">
          {data.completionTrend.map((entry) => {
            const heightPct = maxTrend > 0 ? (entry.count / maxTrend) * 100 : 0;
            return (
              <div key={entry.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  {entry.count}
                </span>
                <div className="w-full flex items-end" style={{ height: '160px' }}>
                  <div
                    className="w-full bg-orange-500 rounded-t-md transition-all"
                    style={{ height: `${Math.max(heightPct, 2)}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{entry.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two-column layout: Recent Completions & Regressions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Completions */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Recent Completions</h2>
          {data.recentCompletions.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No completions yet</p>
          ) : (
            <ul className="space-y-3">
              {data.recentCompletions.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {item.projectName}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {item.boardName}
                      {item.turnaroundDays !== null && ` \u00b7 ${item.turnaroundDays}d`}
                    </p>
                  </div>
                  {item.onTime !== null && (
                    <span
                      className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ml-2',
                        item.onTime
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}
                    >
                      {item.onTime ? 'On Time' : 'Late'}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Regressions */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Regressions</h2>
          {data.regressions.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No regressions recorded</p>
          ) : (
            <ul className="space-y-3">
              {data.regressions.map((item, i) => (
                <li
                  key={i}
                  className="py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                >
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {item.projectName}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {item.fromColumn} &rarr; {item.toColumn} by {item.causedBy}
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {new Date(item.date).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Board Breakdown */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Board Breakdown</h2>
        {data.boardBreakdown.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No board data available</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.boardBreakdown.map((board) => (
              <span
                key={board.boardName}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 border border-orange-200 dark:border-orange-800"
              >
                {board.boardName}
                <span className="bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                  {board.count}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
