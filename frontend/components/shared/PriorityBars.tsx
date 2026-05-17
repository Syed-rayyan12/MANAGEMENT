'use client';

import { cn } from '@/lib/utils';

type PriorityLevel = 'low' | 'medium' | 'high' | 'critical';

interface PriorityBarsProps {
  priority: PriorityLevel;
  showLabel?: boolean;
  className?: string;
}

const priorityConfig: Record<PriorityLevel, { bars: number; color: string; label: string }> = {
  low: { bars: 1, color: 'bg-fg-2', label: 'Low' },
  medium: { bars: 2, color: 'bg-status-amber', label: 'Medium' },
  high: { bars: 3, color: 'bg-accent', label: 'High' },
  critical: { bars: 3, color: 'bg-status-red', label: 'Critical' },
};

export function PriorityBars({ priority, showLabel = false, className }: PriorityBarsProps) {
  const config = priorityConfig[priority] || priorityConfig.low;

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="inline-flex items-end gap-[1.5px]">
        {[4, 7, 10].map((height, i) => (
          <span
            key={i}
            className={cn(
              'w-[2.5px] rounded-[1px]',
              i < config.bars ? config.color : 'bg-border'
            )}
            style={{ height: `${height}px` }}
          />
        ))}
      </span>
      {showLabel && (
        <span className={cn(
          'text-[11px] font-medium',
          priority === 'critical' ? 'text-status-red' : 'text-fg-2'
        )}>
          {config.label}
        </span>
      )}
    </span>
  );
}
