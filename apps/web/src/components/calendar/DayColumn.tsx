'use client';

import { useDroppable } from '@dnd-kit/core';
import { clsx } from 'clsx';
import type { CalendarEvent } from '@/types/calendar';
import type { PositionedEvent } from '@/types/calendar';
import { EventChip } from './EventChip';
import { DropGhost } from './DropGhost';
import { HOUR_HEIGHT, HOURS, TOTAL_HEIGHT } from '@/lib/constants';
import { computePositionedEvents } from '@/lib/overlapLayout';

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
        'relative flex-1 border-r border-slate-200 last:border-r-0',
        isToday && 'bg-blue-50/40',
        isOver && 'bg-indigo-50/30',
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
