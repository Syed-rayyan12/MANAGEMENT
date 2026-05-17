'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/useApp';
import { notificationAPI } from '@/lib/api-service';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Bell,
  CheckCheck,
  UserPlus,
  MessageSquare,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Paperclip,
  ListChecks,
  Clock,
  User,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ─── Type → icon + color config ───────────────────
const TYPE_CONFIG: Record<
  string,
  { icon: React.ReactNode; bg: string; text: string }
> = {
  assigned: {
    icon: <UserPlus className="w-3.5 h-3.5" />,
    bg: 'bg-blue-100 dark:bg-blue-500/20',
    text: 'text-blue-600 dark:text-blue-400',
  },
  developer: {
    icon: <User className="w-3.5 h-3.5" />,
    bg: 'bg-blue-100 dark:bg-blue-500/20',
    text: 'text-blue-600 dark:text-blue-400',
  },
  comment: {
    icon: <MessageSquare className="w-3.5 h-3.5" />,
    bg: 'bg-purple-100 dark:bg-purple-500/20',
    text: 'text-purple-600 dark:text-purple-400',
  },
  status: {
    icon: <ArrowRightLeft className="w-3.5 h-3.5" />,
    bg: 'bg-yellow-100 dark:bg-yellow-500/20',
    text: 'text-yellow-600 dark:text-yellow-400',
  },
  completed: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    bg: 'bg-green-100 dark:bg-green-500/20',
    text: 'text-green-600 dark:text-green-400',
  },
  priority: {
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    bg: 'bg-red-100 dark:bg-red-500/20',
    text: 'text-red-600 dark:text-red-400',
  },
  deleted: {
    icon: <Trash2 className="w-3.5 h-3.5" />,
    bg: 'bg-gray-100 dark:bg-gray-500/20',
    text: 'text-gray-600 dark:text-gray-400',
  },
  attachment: {
    icon: <Paperclip className="w-3.5 h-3.5" />,
    bg: 'bg-accent-soft',
    text: 'text-accent',
  },
  checklist: {
    icon: <ListChecks className="w-3.5 h-3.5" />,
    bg: 'bg-teal-100 dark:bg-teal-500/20',
    text: 'text-teal-600 dark:text-teal-400',
  },
  due_date: {
    icon: <Clock className="w-3.5 h-3.5" />,
    bg: 'bg-amber-100 dark:bg-amber-500/20',
    text: 'text-amber-600 dark:text-amber-400',
  },
};

const getTypeConfig = (type: string) =>
  TYPE_CONFIG[type] ?? {
    icon: <Bell className="w-3.5 h-3.5" />,
    bg: 'bg-gray-100 dark:bg-gray-500/20',
    text: 'text-gray-600 dark:text-gray-400',
  };

const NOTIF_PAGE_SIZE = 15;

export function NotificationsPanel() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const [visibleCount, setVisibleCount] = React.useState(NOTIF_PAGE_SIZE);

  const unreadNotifications = state.notifications.filter((n) => !n.read);
  const sortedNotifications = [...state.notifications].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const visibleNotifications = sortedNotifications.slice(0, visibleCount);
  const hasMore = sortedNotifications.length > visibleCount;

  const handleMarkAsRead = async (notificationId: string) => {
    dispatch({ type: 'MARK_NOTIFICATION_READ', payload: notificationId });
    try {
      await notificationAPI.markAsRead(notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleNotificationClick = (notification: typeof sortedNotifications[0]) => {
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }
    if (notification.projectId) {
      // Find the project in state to get its board slug
      const project = state.projects.find(p => p.id === notification.projectId);
      const boardSlug = project?.board?.slug;
      if (boardSlug) {
        router.push(`/dashboard/${boardSlug}?project=${notification.projectId}`);
      } else {
        // Fallback: open project via my-work
        router.push(`/dashboard/my-work?project=${notification.projectId}`);
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    if (state.currentUser) {
      dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ', payload: state.currentUser.id });
      try {
        await notificationAPI.markAllAsRead();
      } catch (error) {
        console.error('Error marking all notifications as read:', error);
      }
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button aria-label="Open notifications" className="relative w-7 h-7 flex items-center justify-center rounded-md text-fg-3 hover:bg-surface-2 hover:text-foreground transition-colors duration-[120ms]">
          <Bell className="w-[15px] h-[15px]" />
          {unreadNotifications.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-0.5 leading-none">
              {unreadNotifications.length > 99 ? '99+' : unreadNotifications.length}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-96 max-h-[520px] overflow-hidden flex flex-col dark:bg-[#1a1f2e] dark:border-[#2d3548]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-[#2d3548] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-[13px] text-foreground">Notifications</h3>
            {unreadNotifications.length > 0 && (
              <span className="bg-accent-soft text-accent text-[11px] font-medium px-1.5 py-0.5 rounded-full">
                {unreadNotifications.length} new
              </span>
            )}
          </div>
          {unreadNotifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="text-xs h-7 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
            >
              <CheckCheck className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto">
          {sortedNotifications.length === 0 ? (
            <div className="p-10 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-[#2d3548] flex items-center justify-center mx-auto mb-3">
                <Bell className="w-7 h-7 text-gray-300 dark:text-gray-500" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">All caught up!</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No notifications yet</p>
            </div>
          ) : (
            visibleNotifications.map((notification) => {
              const cfg = getTypeConfig(notification.type);
              return (
                <DropdownMenuItem
                  key={notification.id}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer border-b last:border-0 dark:border-[#2d3548] focus:bg-gray-50 dark:focus:bg-[#232938] ${
                    !notification.read
                      ? 'bg-blue-50/60 dark:bg-blue-500/5'
                      : 'bg-white dark:bg-transparent'
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {/* Type icon pill */}
                  <div className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${cfg.bg} ${cfg.text}`}>
                    {cfg.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!notification.read ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                      {notification.message}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!notification.read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                  )}
                </DropdownMenuItem>
              );
            })
          )}

          {hasMore && (
            <div className="px-4 py-2 text-center border-t dark:border-[#2d3548]">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setVisibleCount((c) => c + NOTIF_PAGE_SIZE);
                }}
                className="text-[11px] font-medium text-accent hover:brightness-110 transition-colors duration-[120ms]"
              >
                Load more ({sortedNotifications.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
