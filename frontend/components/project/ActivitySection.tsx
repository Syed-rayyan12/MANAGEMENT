'use client';

import React from 'react';
import { Project } from '@/lib/types';
import { useApp } from '@/contexts/useApp';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Activity } from 'lucide-react';

interface ActivitySectionProps {
  project: Project;
}

export function ActivitySection({ project }: ActivitySectionProps) {
  const { getUserName, getUserAvatar } = useApp();

  return (
    <div className="space-y-4 mt-4">
      {project.activityLog.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No activity yet</p>
          <p className="text-xs mt-1">Actions on this project will appear here</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-orange-500/20" />

          <div className="space-y-4">
            {[...project.activityLog].reverse().map((log) => (
              <div key={log.id} className="flex items-start gap-3 relative pl-10">
                {/* Timeline dot */}
                <div className="absolute left-3 top-1.5 w-3 h-3 rounded-full bg-orange-500 border-2 border-white dark:border-[#0f1219]" />

                <div className="flex-1 p-3 rounded-lg bg-gray-50 dark:bg-[#1a1f2e] border dark:border-orange-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-5 h-5">
                        <AvatarImage src={getUserAvatar(log.userId)} />
                        <AvatarFallback className="text-[8px]">{getUserName(log.userId)[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-semibold dark:text-orange-400">{getUserName(log.userId)}</span>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{log.action}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
