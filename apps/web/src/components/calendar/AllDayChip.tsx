'use client';

import type { CalendarEvent } from '@/types/calendar';
import { EventPopover } from './EventPopover';
import { useCalendarStore } from '@/store/calendarStore';

interface AllDayChipProps {
  event: CalendarEvent;
}

export function AllDayChip({ event }: AllDayChipProps) {
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
        className="mb-0.5 truncate rounded px-1.5 py-0.5 text-xs font-medium text-white cursor-pointer hover:opacity-90 transition-opacity"
        style={{ backgroundColor: event.color }}
        title={event.title}
      >
        {event.title}
      </div>
    </EventPopover>
  );
}
