'use client';

import { cn } from '@/lib/utils';

export type StatusVariant = 'todo' | 'progress' | 'review' | 'revisions' | 'done' | 'blocked';

interface StatusPillProps {
  variant: StatusVariant;
  label: string;
  showDot?: boolean;
  className?: string;
}

const variantStyles: Record<StatusVariant, { bg: string; text: string; dot: string }> = {
  todo: {
    bg: 'bg-surface-3',
    text: 'text-fg-3',
    dot: 'bg-fg-4',
  },
  progress: {
    bg: 'bg-status-blue-soft',
    text: 'text-status-blue',
    dot: 'bg-status-blue',
  },
  review: {
    bg: 'bg-status-violet-soft',
    text: 'text-status-violet',
    dot: 'bg-status-violet',
  },
  revisions: {
    bg: 'bg-status-amber-soft',
    text: 'text-status-amber',
    dot: 'bg-status-amber',
  },
  done: {
    bg: 'bg-status-green-soft',
    text: 'text-status-green',
    dot: 'bg-status-green',
  },
  blocked: {
    bg: 'bg-status-red-soft',
    text: 'text-status-red',
    dot: 'bg-status-red',
  },
};

export function StatusPill({ variant, label, showDot = true, className }: StatusPillProps) {
  const styles = variantStyles[variant] || variantStyles.todo;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-[7px] py-[2px] rounded-full text-pill font-medium',
        styles.bg,
        styles.text,
        className
      )}
    >
      {showDot && (
        <span className={cn('w-1.5 h-1.5 rounded-full', styles.dot)} />
      )}
      {label}
    </span>
  );
}

// Helper to map common status strings to variants
export function getStatusVariant(status: string): StatusVariant {
  const s = status.toLowerCase().replace(/[_\s-]/g, '');
  if (s.includes('done') || s.includes('complete') || s.includes('shipped') || s.includes('paid')) return 'done';
  if (s.includes('progress') || s.includes('active')) return 'progress';
  if (s.includes('review') || s.includes('internal')) return 'review';
  if (s.includes('revision') || s.includes('pending') || s.includes('client')) return 'revisions';
  if (s.includes('block') || s.includes('overdue') || s.includes('failed')) return 'blocked';
  return 'todo';
}
