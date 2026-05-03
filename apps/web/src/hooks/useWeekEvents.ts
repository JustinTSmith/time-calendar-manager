import { useMemo } from 'react';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { MOCK_EVENTS } from '@/data/mockEvents';
import type { CalendarEvent } from '@/types/calendar';

export function useWeekEvents(
  weekStart: Date,
  weekEnd: Date,
  visibleCalendarIds: Set<string>,
): { timedEvents: CalendarEvent[]; allDayEvents: CalendarEvent[] } {
  return useMemo(() => {
    const interval = { start: startOfDay(weekStart), end: endOfDay(weekEnd) };

    const inWeek = MOCK_EVENTS.filter(
      (e) =>
        visibleCalendarIds.has(e.calendarId) &&
        isWithinInterval(e.startAt, interval),
    );

    return {
      timedEvents: inWeek.filter((e) => !e.isAllDay),
      allDayEvents: inWeek.filter((e) => e.isAllDay),
    };
  }, [weekStart, weekEnd, visibleCalendarIds]);
}
