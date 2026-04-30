'use client';

import { clsx } from 'clsx';
import type { CalendarEvent } from '@/types/calendar';
import type { PositionedEvent } from '@/types/calendar';
import { EventChip } from './EventChip';
import { HOUR_HEIGHT, HOURS, TOTAL_HEIGHT } from '@/lib/constants';
import { computePositionedEvents } from '@/lib/overlapLayout';

interface DayColumnProps {
  day: Date;
  isToday: boolean;
  events: CalendarEvent[];
}

export function DayColumn({ day, isToday, events }: DayColumnProps) {
  const positioned: PositionedEvent[] = computePositionedEvents(events, day);

  return (
    <div
      className={clsx(
        'relative flex-1 border-r border-slate-200 last:border-r-0',
        isToday && 'bg-blue-50/40',
      )}
      style={{ height: TOTAL_HEIGHT }}
    >
      {/* Hour gridlines */}
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="absolute inset-x-0 border-t border-slate-100"
          style={{ top: hour * HOUR_HEIGHT }}
        />
      ))}

      {/* Positioned events */}
      {positioned.map((p) => (
        <EventChip
          key={p.event.id}
          event={p.event}
          top={p.top}
          height={p.height}
          left={p.left}
          width={p.width}
        />
      ))}
    </div>
  );
}
