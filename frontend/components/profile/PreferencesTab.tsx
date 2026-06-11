'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function PreferencesTab() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes is undefined on the server — render the active state only after mount
  useEffect(() => setMounted(true), []);

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Appearance</h3>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        Choose how XRM looks for you.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3 max-w-sm">
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = mounted && theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              aria-pressed={active}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border px-3 py-4 text-sm font-medium transition-all duration-200 ease-out',
                active
                  ? 'border-[#e05c29] bg-[#e05c29]/8 text-[#e05c29]'
                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-[#e05c29]/40 hover:text-[#e05c29]'
              )}
            >
              <Icon className="w-4 h-4" />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
