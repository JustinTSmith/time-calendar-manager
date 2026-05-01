'use client';

import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';

interface SocketProviderProps {
  children: React.ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) return;

    const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001', {
      auth: { token: accessToken },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
    });

    socket.on('event:created', ({ calendarId }: { calendarId: string }) => {
      console.log('[Socket] Event created in calendar:', calendarId);
      queryClient.invalidateQueries({ queryKey: ['events'] });
    });

    socket.on('event:updated', ({ eventId }: { eventId: string }) => {
      console.log('[Socket] Event updated:', eventId);
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    });

    socket.on('event:deleted', ({ eventId }: { eventId: string }) => {
      console.log('[Socket] Event deleted:', eventId);
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.removeQueries({ queryKey: ['events', eventId] });
    });

    socket.on('task:updated', ({ taskId }: { taskId: string }) => {
      console.log('[Socket] Task updated:', taskId);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', taskId] });
    });

    socket.on('calendar:sync_complete', ({ accountId }: { accountId: string }) => {
      console.log('[Socket] Calendar sync completed for account:', accountId);
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['calendars'] });
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken, queryClient]);

  return <>{children}</>;
}
