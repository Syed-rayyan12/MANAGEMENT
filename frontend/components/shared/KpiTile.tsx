'use client';

import { cn } from '@/lib/utils';
import { Sparkline } from './Sparkline';

interface KpiTileProps {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  sparkData?: number[];
  accentColor?: string;
  className?: string;
}

export function KpiTile({ label, value, delta, deltaPositive, sparkData, accentColor = 'var(--accent)', className }: KpiTileProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-border bg-surface p-[14px] flex flex-col gap-1.5',
        className
      )}
    >
      <span className="text-[12px] font-medium text-fg-3">{label}</span>
      <span className="text-kpi font-mono font-medium text-foreground">{value}</span>
      {delta && (
        <span className={cn(
          'text-[11px] font-medium',
          deltaPositive ? 'text-status-green' : 'text-status-red'
        )}>
          {delta}
        </span>
      )}
      {sparkData && sparkData.length >= 2 && (
        <div className="absolute bottom-2 right-2 opacity-60">
          <Sparkline data={sparkData} color={accentColor} width={70} height={24} />
        </div>
      )}
    </div>
  );
}
