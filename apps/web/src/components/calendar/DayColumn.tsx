'use client';

<<<<<<< HEAD
import { useCallback } from 'react';
=======
import { useDroppable } from '@dnd-kit/core';
>>>>>>> origin/blocks/jus-25-drag-task-calendar-time-blocking-drop-handler
import { clsx } from 'clsx';
import type { CalendarEvent } from '@/types/calendar';
import type { PositionedEvent } from '@/types/calendar';
import { EventChip } from './EventChip';
import { DropGhost } from './DropGhost';
import { HOUR_HEIGHT, HOURS, TOTAL_HEIGHT } from '@/lib/constants';
import { computePositionedEvents } from '@/lib/overlapLayout';
import { useCalendarStore } from '@/store/calendarStore';
import { getTimeFromClick } from '@/lib/eventUtils';
import { MOCK_CALENDARS } from '@/data/mockEvents';

interface DayColumnProps {
  day: Date;
  isToday: boolean;
  events: CalendarEvent[];
  dragState?: {
    isOver: boolean;
    dropTime: Date | null;
    taskTitle: string;
    durationMinutes: number;
  };
}

export function DayColumn({ day, isToday, events, dragState }: DayColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `day-${day.toISOString()}`,
    data: {
      type: 'dayColumn',
      date: day,
    },
  });

  const positioned: PositionedEvent[] = computePositionedEvents(events, day);
  const openQuickCreate = useCalendarStore((state) => state.openQuickCreate);
  const visibleCalendarIds = useCalendarStore((state) => state.visibleCalendarIds);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only handle clicks on the column background, not on event chips
      if ((e.target as HTMLElement).closest('[data-event-chip]')) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top + e.currentTarget.scrollTop;
      const x = e.clientX - rect.left;

      const clickedTime = getTimeFromClick(y, TOTAL_HEIGHT, day);
      const defaultCalendarId = visibleCalendarIds[0] || MOCK_CALENDARS[0]?.id || '';
      const defaultCalendar = MOCK_CALENDARS.find((c) => c.id === defaultCalendarId);

      openQuickCreate(
        {
          startAt: clickedTime,
          calendarId: defaultCalendarId,
          color: defaultCalendar?.color || '#4285F4',
        },
        { x: e.clientX, y: e.clientY }
      );
    },
    [day, openQuickCreate, visibleCalendarIds]
  );

  // Calculate ghost position if dragging over this column
  let ghostTop = 0;
  let ghostHeight = 0;
  let showGhost = false;

  if (dragState?.isOver && dragState.dropTime) {
    const hour = dragState.dropTime.getHours();
    const minutes = dragState.dropTime.getMinutes();
    ghostTop = hour * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
    ghostHeight = (dragState.durationMinutes / 60) * HOUR_HEIGHT;
    showGhost = true;
  }

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'relative flex-1 border-r border-slate-200 last:border-r-0 cursor-pointer',
        isToday && 'bg-blue-50/40',
        isOver && 'bg-indigo-50/30',
      )}
      style={{ height: TOTAL_HEIGHT }}
      onClick={handleClick}
    >
      {/* Hour gridlines */}
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="absolute inset-x-0 border-t border-slate-100 pointer-events-none"
          style={{ top: hour * HOUR_HEIGHT }}
        />
      ))}

      {/* Drop ghost */}
      {showGhost && (
        <DropGhost
          top={ghostTop}
          height={ghostHeight}
          title={dragState!.taskTitle}
          durationMinutes={dragState!.durationMinutes}
        />
      )}

      {/* Positioned events */}
      {positioned.map((p) => (
        <div key={p.event.id} data-event-chip>
          <EventChip
            event={p.event}
            top={p.top}
            height={p.height}
            left={p.left}
            width={p.width}
          />
        </div>
      ))}
    </div>
  );
}
