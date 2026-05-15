'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useApp } from '@/contexts/useApp';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
});

export function useSocket() {
  return useContext(SocketContext);
}

const SOCKET_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api')
  .replace(/\/api$/, ''); // strip /api — Socket.io connects to root

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { state, dispatch } = useApp();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Only connect when user is logged in
    if (!state.currentUser) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      setIsConnected(false);
    });

    // ─── Global notification listener ────────────────
    socket.on('notification:new', (notification: any) => {
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: notification.id,
          userId: notification.userId,
          type: notification.type,
          projectId: notification.projectId || '',
          read: false,
          timestamp: new Date(notification.timestamp),
          message: notification.message,
        },
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [state.currentUser, dispatch]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
