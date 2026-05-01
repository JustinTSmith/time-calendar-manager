'use client';

import type { CalendarEvent } from '@/types/calendar';
import { format } from 'date-fns';
import { EventPopover } from './EventPopover';
import { useCalendarStore } from '@/store/calendarStore';

interface EventChipProps {
  event: CalendarEvent;
  top: number;
  height: number;
  left: number;
  width: number;
}

export function EventChip({ event, top, height, left, width }: EventChipProps) {
  const showTime = height >= 40;
  const openEventModal = useCalendarStore((state) => state.openEventModal);
  const deleteEvent = useCalendarStore((state) => state.deleteEvent);

  const handleEdit = () => {
    openEventModal(event.id);
  };

  const handleDelete = () => {
    if (confirm(`Delete "${event.title}"?`)) {
      deleteEvent(event.id);
    }
  };

  return (
    <EventPopover event={event} onEdit={handleEdit} onDelete={handleDelete}>
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
    </EventPopover>
  );
}
