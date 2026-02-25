'use client';

import React from 'react';
import { useApp } from '@/contexts/useApp';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function NotificationsPanel() {
  const { state, dispatch } = useApp();

  const unreadNotifications = state.notifications.filter((n) => !n.read);
  const sortedNotifications = [...state.notifications].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const handleMarkAsRead = (notificationId: string) => {
    dispatch({ type: 'MARK_NOTIFICATION_READ', payload: notificationId });
  };

  const handleMarkAllAsRead = () => {
    if (state.currentUser) {
      dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ', payload: state.currentUser.id });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5 text-gray-600" />
          {unreadNotifications.length > 0 && (
            <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full min-w-5 h-5 flex items-center justify-center px-1">
              {unreadNotifications.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between p-2 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadNotifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="text-xs h-7"
            >
              <CheckCheck className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {sortedNotifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          sortedNotifications.slice(0, 20).map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className={`flex items-start gap-3 p-3 cursor-pointer ${
                !notification.read ? 'bg-blue-50' : ''
              }`}
              onClick={() => !notification.read && handleMarkAsRead(notification.id)}
            >
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${!notification.read ? 'font-medium' : ''}`}>
                  {notification.message}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                </p>
              </div>
              {!notification.read && (
                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
              )}
            </DropdownMenuItem>
          ))
        )}

        {sortedNotifications.length > 20 && (
          <div className="p-2 text-center border-t">
            <p className="text-xs text-gray-500">
              Showing 20 of {sortedNotifications.length} notifications
            </p>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
