'use client';

import type { CalendarEvent } from '@/types/calendar';
import { format } from 'date-fns';

interface EventChipProps {
  event: CalendarEvent;
  top: number;
  height: number;
  left: number;
  width: number;
}

export function EventChip({ event, top, height, left, width }: EventChipProps) {
  const showTime = height >= 40;
  const showTitleOnly = height < 40 && height >= 20;

  return (
    <div
      className="absolute overflow-hidden rounded px-1.5 py-0.5 text-white cursor-pointer select-none transition-opacity hover:opacity-90"
      style={{
        top,
        height,
        left: `${left * 100}%`,
        width: `calc(${width * 100}% - 2px)`,
        backgroundColor: event.color,
        border: event.isTimeBlock ? '2px dashed rgba(255,255,255,0.6)' : undefined,
        zIndex: 10,
      }}
      title={event.title}
    >
      <p className="truncate text-xs font-medium leading-tight">{event.title}</p>
      {showTime && (
        <p className="truncate text-xs opacity-80 leading-tight">
          {format(event.startAt, 'h:mm')} – {format(event.endAt, 'h:mm a')}
        </p>
      )}
    </div>
  );
}
