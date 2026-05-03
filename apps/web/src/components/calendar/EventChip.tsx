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
<<<<<<< HEAD
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
=======
    <div
      className="absolute overflow-hidden rounded px-1.5 py-0.5 text-white cursor-pointer select-none transition-opacity hover:opacity-90"
      style={{
        top,
        height,
        left: `${left * 100}%`,
        width: `calc(${width * 100}% - 2px)`,
        backgroundColor: event.color,
        border: event.isTimeBlock ? '2px dashed rgba(255,255,255,0.6)' : undefined,
        backgroundImage: event.isTimeBlock
          ? 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.1) 5px, rgba(255,255,255,0.1) 10px)'
          : undefined,
        zIndex: 10,
      }}
      title={event.title}
    >
      <p className="truncate text-xs font-medium leading-tight flex items-center gap-1">
        {event.isTimeBlock && (
          <span className="inline-flex items-center justify-center w-3 h-3 text-[10px] opacity-80">⊡</span>
        )}
        <span className="truncate">{event.title}</span>
      </p>
      {showTime && (
        <p className="truncate text-xs opacity-80 leading-tight">
          {format(event.startAt, 'h:mm')} – {format(event.endAt, 'h:mm a')}
        </p>
      )}
    </div>
>>>>>>> origin/blocks/jus-25-drag-task-calendar-time-blocking-drop-handler
  );
}
