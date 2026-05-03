'use client';

import { useState } from 'react';
import { useDndMonitor } from '@dnd-kit/core';
import { addMinutes, startOfDay, setMinutes } from 'date-fns';
import type { Task } from '@/types/task';
import type { CalendarEvent } from '@/types/calendar';
import { HOUR_HEIGHT } from '@/lib/constants';

interface DragState {
  isDragging: boolean;
  activeDay: Date | null;
  dropTime: Date | null;
  taskTitle: string;
  durationMinutes: number;
}

interface UseTaskDropOptions {
  tasks: Task[];
  onEventCreated?: (event: CalendarEvent) => void;
  onTaskUpdated?: (task: Task) => void;
}

export function useTaskDrop({ tasks, onEventCreated, onTaskUpdated }: UseTaskDropOptions) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    activeDay: null,
    dropTime: null,
    taskTitle: '',
    durationMinutes: 0,
  });

  useDndMonitor({
    onDragStart(event) {
      const { active } = event;
      const data = active.data.current;

      if (data?.type === 'task') {
        setDragState({
          isDragging: true,
          activeDay: null,
          dropTime: null,
          taskTitle: data.title || '',
          durationMinutes: data.durationMinutes || 0,
        });
      }
    },

    onDragOver(event) {
      const { active, over } = event;
      const data = active.data.current;

      if (data?.type === 'task' && over) {
        const overData = over.data.current;
        if (overData?.type === 'dayColumn') {
          const day = overData.date as Date;
          
          // Use the over.rect to get the droppable element's position
          // and calculate where in the day the drag is happening
          const rect = over.rect;
          
          // Get the scrollable container
          const scrollableGrid = document.querySelector('[data-scrollable-grid]');
          const scrollOffset = scrollableGrid?.scrollTop || 0;
          
          // Get the active (dragged) element's rect
          const activeRect = active.rect.current.translated;
          
          if (activeRect) {
            // Calculate position relative to the day column
            const relativeY = activeRect.top - rect.top + scrollOffset;
            
            // Snap to 15-minute increments
            const minutesFromMidnight = Math.round((relativeY / HOUR_HEIGHT) * 60 / 15) * 15;
            const clampedMinutes = Math.max(0, Math.min(23 * 60 + 45, minutesFromMidnight));
            
            const dayStart = startOfDay(day);
            const dropTime = setMinutes(dayStart, clampedMinutes);

            setDragState((prev) => ({
              ...prev,
              activeDay: day,
              dropTime,
            }));
          }
        }
      }
    },

    onDragEnd(event) {
      const { active, over } = event;
      const data = active.data.current;

      if (data?.type === 'task' && over) {
        const overData = over.data.current;
        if (overData?.type === 'dayColumn') {
          const day = overData.date as Date;
          const rect = over.rect;
          
          const scrollableGrid = document.querySelector('[data-scrollable-grid]');
          const scrollOffset = scrollableGrid?.scrollTop || 0;
          
          const activeRect = active.rect.current.translated;
          
          if (activeRect) {
            const relativeY = activeRect.top - rect.top + scrollOffset;
            
            const minutesFromMidnight = Math.round((relativeY / HOUR_HEIGHT) * 60 / 15) * 15;
            const clampedMinutes = Math.max(0, Math.min(23 * 60 + 45, minutesFromMidnight));
            
            const dayStart = startOfDay(day);
            const startAt = setMinutes(dayStart, clampedMinutes);

            const taskId = data.taskId as string;
            const durationMinutes = data.durationMinutes as number;
            const taskTitle = data.title as string;
            const scheduledEventId = data.scheduled_event_id as string | undefined;

            const endAt = addMinutes(startAt, durationMinutes);

            // Find the task
            const task = tasks.find((t) => t.id === taskId);

            if (task) {
              // Create or update the event
              if (scheduledEventId) {
                // Reschedule existing event
                const updatedEvent: CalendarEvent = {
                  id: scheduledEventId,
                  title: taskTitle,
                  startAt,
                  endAt,
                  calendarId: 'cal-work',
                  color: '#6366f1',
                  isTimeBlock: true,
                  isAllDay: false,
                };
                onEventCreated?.(updatedEvent);
              } else {
                // Create new time block event
                const newEvent: CalendarEvent = {
                  id: `event-${Date.now()}`,
                  title: taskTitle,
                  startAt,
                  endAt,
                  calendarId: 'cal-work',
                  color: '#6366f1',
                  isTimeBlock: true,
                  isAllDay: false,
                };

                // Update task with scheduled event id
                const updatedTask: Task = {
                  ...task,
                  scheduled_event_id: newEvent.id,
                };

                onEventCreated?.(newEvent);
                onTaskUpdated?.(updatedTask);
              }
            }
          }
        }
      }

      setDragState({
        isDragging: false,
        activeDay: null,
        dropTime: null,
        taskTitle: '',
        durationMinutes: 0,
      });
    },

    onDragCancel() {
      setDragState({
        isDragging: false,
        activeDay: null,
        dropTime: null,
        taskTitle: '',
        durationMinutes: 0,
      });
    },
  });

  return { dragState };
}
