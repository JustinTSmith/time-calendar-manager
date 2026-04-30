'use client';

import type { CalendarEvent } from '@/types/calendar';

interface AllDayChipProps {
  event: CalendarEvent;
}

export function AllDayChip({ event }: AllDayChipProps) {
  return (
    <div
      className="mb-0.5 truncate rounded px-1.5 py-0.5 text-xs font-medium text-white cursor-pointer hover:opacity-90 transition-opacity"
      style={{ backgroundColor: event.color }}
      title={event.title}
    >
      {event.title}
    </div>
  );
}
