'use client';

import { useCallback } from 'react';
import { clsx } from 'clsx';
import type { CalendarEvent } from '@/types/calendar';
import type { PositionedEvent } from '@/types/calendar';
import { EventChip } from './EventChip';
import { HOUR_HEIGHT, HOURS, TOTAL_HEIGHT } from '@/lib/constants';
import { computePositionedEvents } from '@/lib/overlapLayout';
import { useCalendarStore } from '@/store/calendarStore';
import { getTimeFromClick } from '@/lib/eventUtils';
import { MOCK_CALENDARS } from '@/data/mockEvents';

interface DayColumnProps {
  day: Date;
  isToday: boolean;
  events: CalendarEvent[];
}

export function DayColumn({ day, isToday, events }: DayColumnProps) {
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

  return (
    <div
      className={clsx(
        'relative flex-1 border-r border-slate-200 last:border-r-0 cursor-pointer',
        isToday && 'bg-blue-50/40',
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
