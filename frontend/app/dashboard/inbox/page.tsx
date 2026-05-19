'use client';

import React from 'react';
import { useApp } from '@/contexts/useApp';
import { Inbox as InboxIcon } from 'lucide-react';

export default function InboxPage() {
  const { state } = useApp();
  const notifications = state.notifications || [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-[24px] font-semibold text-foreground tracking-[-0.02em]">Inbox</h1>
        <p className="text-[13px] text-fg-3 mt-0.5">
          {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Notification List */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-lg bg-accent-soft flex items-center justify-center mb-3">
            <InboxIcon className="w-6 h-6 text-accent" />
          </div>
          <h2 className="text-[15px] font-semibold text-foreground mb-1">All caught up</h2>
          <p className="text-[13px] text-fg-3">No new notifications.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((notif: any, i: number) => (
            <div
              key={notif.id || i}
              className="flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-surface-2 transition-colors duration-[120ms] group"
            >
              {/* Unread dot */}
              {!notif.read && (
                <div className="w-2 h-2 rounded-full bg-accent mt-1.5 flex-shrink-0" />
              )}
              {notif.read && <div className="w-2 flex-shrink-0" />}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-foreground leading-snug">
                  <span className="text-fg-2">{notif.message || notif.action || 'Something happened'}</span>
                </p>
                {notif.projectName && (
                  <p className="text-[11px] text-fg-3 mt-0.5 truncate">{notif.projectName}</p>
                )}
              </div>

              {/* Time */}
              <span className="text-[10.5px] font-mono text-fg-4 flex-shrink-0">
                {notif.timestamp ? new Date(notif.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
