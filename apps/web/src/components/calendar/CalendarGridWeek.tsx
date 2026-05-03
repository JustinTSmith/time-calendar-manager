'use client';

import { useMemo } from 'react';
import { useCalendarStore } from '@/store/calendarStore';
import { useWeekEvents } from '@/hooks/useWeekEvents';
import { getWeekDays, getWeekStart, getWeekEnd } from '@/lib/dateUtils';
import { WeekNavBar } from './WeekNavBar';
import { ViewToggle } from './ViewToggle';
import { WeekHeader } from './WeekHeader';
import { AllDayZone } from './AllDayZone';
import { ScrollableGrid } from './ScrollableGrid';
import { EventQuickCreate } from './EventQuickCreate';
import { EventModal } from './EventModal';

const TODAY = new Date();

export function CalendarGridWeek() {
  const {
    view,
    currentDate,
    visibleCalendarIds,
    setView,
    goToPrevWeek,
    goToNextWeek,
    goToToday,
    events,
    selectedEventId,
    draftEvent,
  } = useCalendarStore();

  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);
  const weekEnd = useMemo(() => getWeekEnd(currentDate), [currentDate]);
  const days = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const { timedEvents, allDayEvents } = useWeekEvents(weekStart, weekEnd, visibleCalendarIds);

  // Get the event being edited (if any)
  const editingEvent = selectedEventId
    ? events.find((e) => e.id === selectedEventId) || null
    : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      {/* Top toolbar */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 shrink-0">
        <WeekNavBar
          currentDate={currentDate}
          onPrev={goToPrevWeek}
          onNext={goToNextWeek}
          onToday={goToToday}
        />
        <ViewToggle current={view} onChange={setView} />
      </div>

      {/* Column headers */}
      <WeekHeader days={days} today={TODAY} />

      {/* All-day strip */}
      <AllDayZone days={days} allDayEvents={allDayEvents} />

      {/* Scrollable timed grid */}
      <ScrollableGrid days={days} timedEvents={timedEvents} today={TODAY} />

      {/* Quick-create popover */}
      <EventQuickCreate />

      {/* Full event modal */}
      <EventModal event={editingEvent} draftEvent={draftEvent} />
    </div>
  );
}
