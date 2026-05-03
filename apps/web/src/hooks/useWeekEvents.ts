import { useMemo } from 'react';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { useCalendarStore } from '@/store/calendarStore';
import type { CalendarEvent } from '@/types/calendar';

export function useWeekEvents(
  weekStart: Date,
  weekEnd: Date,
  visibleCalendarIds: Set<string>,
): { timedEvents: CalendarEvent[]; allDayEvents: CalendarEvent[] } {
  const events = useCalendarStore((state) => state.events);
  
  return useMemo(() => {
    const interval = { start: startOfDay(weekStart), end: endOfDay(weekEnd) };

    const inWeek = events.filter(
      (e) =>
        visibleCalendarIds.has(e.calendarId) &&
        isWithinInterval(e.startAt, interval),
    );

    return {
      timedEvents: inWeek.filter((e) => !e.isAllDay),
      allDayEvents: inWeek.filter((e) => e.isAllDay),
    };
  }, [events, weekStart, weekEnd, visibleCalendarIds]);
}
