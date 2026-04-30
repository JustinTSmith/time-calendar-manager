'use client';

import { CALENDAR_COLORS } from '@/lib/calendarColors';
import { useCalendarStore } from '@/store/calendarStore';
import type { CalendarSetDto } from '@time-calendar-manager/types';

interface Props {
  set: CalendarSetDto;
  index: number;
}

export function CalendarSetChip({ set, index }: Props) {
  const visibleCalendarIds = useCalendarStore((s) => s.visibleCalendarIds);
  const setCalendarSetVisible = useCalendarStore((s) => s.setCalendarSetVisible);

  const color = CALENDAR_COLORS[index % CALENDAR_COLORS.length];
  const isActive =
    set.calendarIds.length > 0 && set.calendarIds.every((id) => visibleCalendarIds.has(id));

  function handleClick() {
    setCalendarSetVisible(set.calendarIds, !isActive);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-opacity"
      style={{
        backgroundColor: isActive ? color : '#e5e7eb',
        color: isActive ? '#fff' : '#6b7280',
      }}
      title={isActive ? `Hide all calendars in "${set.name}"` : `Show all calendars in "${set.name}"`}
    >
      {set.name}
    </button>
  );
}
