'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkspaceSearchProps {
  value: string;
  onChange: (query: string) => void;
}

export function WorkspaceSearch({ value, onChange }: WorkspaceSearchProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const expand = useCallback(() => {
    setIsExpanded(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const collapse = useCallback(() => {
    if (value) return; // keep open while there's a query
    setIsExpanded(false);
    inputRef.current?.blur();
  }, [value]);

  const clear = useCallback(() => {
    onChange('');
    setIsExpanded(false);
    inputRef.current?.blur();
  }, [onChange]);

  // Close on click outside
  useEffect(() => {
    if (!isExpanded) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        collapse();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isExpanded, collapse]);

  // Close on Escape
  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clear();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, clear]);

  // Ctrl/Cmd + K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isExpanded) {
          clear();
        } else {
          expand();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, expand, clear]);

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border transition-all duration-300 ease-out overflow-hidden cursor-text',
          isExpanded
            ? 'w-[min(360px,50vw)] px-3 py-1.5 border-accent/50 dark:border-accent/40 bg-white dark:bg-zinc-900 shadow-md shadow-accent/5 ring-1 ring-accent/15'
            : 'w-auto px-3 py-1.5 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600'
        )}
        onClick={() => !isExpanded && expand()}
      >
        <Search className={cn(
          'w-4 h-4 flex-shrink-0 transition-colors duration-200',
          isExpanded ? 'text-accent' : 'text-zinc-400 dark:text-zinc-500'
        )} />

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search projects..."
          className={cn(
            'bg-transparent border-none outline-none text-sm transition-all duration-300 ease-out',
            'text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
            isExpanded ? 'w-full opacity-100' : 'w-0 opacity-0 pointer-events-none'
          )}
          autoComplete="off"
        />

        {/* Show clear button when there's text */}
        {value && isExpanded && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Collapsed: show hint text + shortcut */}
        {!isExpanded && (
          <>
            <span className="text-sm text-zinc-400 dark:text-zinc-500 hidden sm:inline whitespace-nowrap">Search...</span>
            <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-700 ml-1">
              Ctrl K
            </kbd>
          </>
        )}

        {/* Expanded: show ESC hint */}
        {isExpanded && !value && (
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-700 flex-shrink-0">
            ESC
          </kbd>
        )}
      </div>
    </div>
  );
}
