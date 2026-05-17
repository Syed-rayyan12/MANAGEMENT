'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#1a1f2e] dark:border dark:border-[#2d3548] rounded-lg p-3 space-y-3">
      {/* Drag handle */}
      <div className="flex items-center justify-center pb-2 border-b border-gray-100 dark:border-[#2d3548]">
        <Skeleton className="w-8 h-1 rounded-full dark:bg-surface-3" />
      </div>
      {/* Title */}
      <Skeleton className="h-4 w-3/4 dark:bg-surface-2" />
      <Skeleton className="h-3 w-1/2 dark:bg-surface-2" />
      {/* Priority badge */}
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full dark:bg-surface-2" />
        <Skeleton className="h-5 w-20 rounded-full dark:bg-surface-2" />
      </div>
      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full dark:bg-surface-2" />
          <Skeleton className="h-3 w-16 dark:bg-surface-2" />
        </div>
        <Skeleton className="h-3 w-12 dark:bg-surface-2" />
      </div>
    </div>
  );
}

function ColumnSkeleton({ cardCount = 3 }: { cardCount?: number }) {
  return (
    <div className="flex flex-col bg-gray-100 dark:bg-[#1a1f2e] dark:border dark:border-[#2d3548] rounded-lg p-4 min-w-[320px] h-[calc(100vh-200px)]">
      {/* Column header */}
      <div className="mb-4 flex items-center gap-2 flex-shrink-0">
        <Skeleton className="w-3 h-3 rounded-full dark:bg-surface-3" />
        <Skeleton className="h-4 w-24 dark:bg-surface-2" />
        <Skeleton className="h-5 w-6 rounded-full dark:bg-surface-2" />
      </div>
      {/* Cards */}
      <div className="flex-1 space-y-3">
        {Array.from({ length: cardCount }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        <ColumnSkeleton cardCount={3} />
        <ColumnSkeleton cardCount={2} />
        <ColumnSkeleton cardCount={1} />
        <ColumnSkeleton cardCount={2} />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 p-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 dark:bg-surface-2" />
        <Skeleton className="h-4 w-96 dark:bg-surface-2" />
      </div>
      {/* Workspace cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border-2 dark:border-border overflow-hidden">
            <Skeleton className="w-full h-40 rounded-none dark:bg-surface-2" />
            <div className="p-6 space-y-4">
              <Skeleton className="h-6 w-32 dark:bg-surface-2" />
              <Skeleton className="h-3 w-full dark:bg-surface-2" />
              <Skeleton className="h-3 w-3/4 dark:bg-surface-2" />
              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-border">
                <Skeleton className="h-4 w-20 dark:bg-surface-2" />
                <Skeleton className="h-8 w-8 rounded-full dark:bg-surface-2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-lg border dark:bg-[#1a1f2e] dark:border-[#2d3548] p-6">
          <div className="flex items-center justify-between pb-2">
            <Skeleton className="h-4 w-28 dark:bg-surface-2" />
            <Skeleton className="h-8 w-8 rounded-lg dark:bg-surface-2" />
          </div>
          <Skeleton className="h-8 w-12 mt-2 dark:bg-surface-2" />
        </div>
      ))}
    </div>
  );
}
