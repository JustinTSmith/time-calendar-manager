'use client';

import { isSameDay } from 'date-fns';
import type { CalendarEvent } from '@/types/calendar';
import { AllDayChip } from './AllDayChip';
import { TIME_GUTTER_WIDTH } from '@/lib/constants';

interface AllDayZoneProps {
  days: Date[];
  allDayEvents: CalendarEvent[];
}

export function AllDayZone({ days, allDayEvents }: AllDayZoneProps) {
  if (allDayEvents.length === 0) return null;

  return (
    <div className="flex border-b border-slate-200 bg-slate-50">
      <div className="shrink-0 border-r border-slate-200 px-1 py-1">
        <span className="text-xs text-slate-400 leading-none" style={{ width: TIME_GUTTER_WIDTH - 8 }}>
          all-day
        </span>
      </div>
      {days.map((day) => {
        const dayEvents = allDayEvents.filter((e) => isSameDay(e.startAt, day));
        return (
          <div
            key={day.toISOString()}
            className="flex-1 min-h-7 border-r border-slate-200 last:border-r-0 px-0.5 py-0.5"
          >
            {dayEvents.map((event) => (
              <AllDayChip key={event.id} event={event} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
