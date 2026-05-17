'use client';

import React from 'react';
import { Project } from '@/lib/types';
import { useApp } from '@/contexts/useApp';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Activity } from 'lucide-react';

interface ActivitySectionProps {
  project: Project;
  compact?: boolean;
}

export function ActivitySection({ project, compact }: ActivitySectionProps) {
  const { getUserName, getUserAvatar } = useApp();

  const activities = [...(project.activityLog || [])].reverse();
  const displayActivities = compact ? activities.slice(0, 6) : activities;

  if (compact) {
    return (
      <div className="space-y-0">
        {displayActivities.length === 0 ? (
          <p className="text-[11px] text-fg-4 py-2">No activity yet</p>
        ) : (
          displayActivities.map((log) => (
            <div key={log.id} className="flex items-start gap-2 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-fg-4 mt-[7px] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[11.5px] leading-snug">
                  <b className="font-medium text-foreground">{getUserName(log.userId)}</b>{' '}
                  <span className="text-fg-3">{log.action}</span>
                </span>
                <div className="text-[10px] text-fg-4 mt-0.5">
                  {new Date(log.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {activities.length === 0 ? (
        <div className="text-center py-8 text-fg-3">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No activity yet</p>
          <p className="text-xs mt-1 text-fg-4">Actions on this project will appear here</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-surface-3" />

          <div className="space-y-4">
            {displayActivities.map((log) => (
              <div key={log.id} className="flex items-start gap-3 relative pl-10">
                <div className="absolute left-3 top-1.5 w-3 h-3 rounded-full bg-accent border-2 border-background" />
                <div className="flex-1 p-3 rounded-lg bg-surface-2 border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-5 h-5">
                        <AvatarImage src={getUserAvatar(log.userId)} />
                        <AvatarFallback className="text-[8px]">{getUserName(log.userId)[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-semibold text-foreground">{getUserName(log.userId)}</span>
                    </div>
                    <span className="text-[11px] text-fg-4">
                      {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-fg-2 mt-1">{log.action}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
