'use client';

import { useMemo, useState, useCallback } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useCalendarStore } from '@/store/calendarStore';
import { useWeekEvents } from '@/hooks/useWeekEvents';
import { useTaskDrop } from '@/hooks/useTaskDrop';
import { getWeekDays, getWeekStart, getWeekEnd } from '@/lib/dateUtils';
import { WeekNavBar } from './WeekNavBar';
import { ViewToggle } from './ViewToggle';
import { WeekHeader } from './WeekHeader';
import { AllDayZone } from './AllDayZone';
import { ScrollableGrid } from './ScrollableGrid';
<<<<<<< HEAD
import { EventQuickCreate } from './EventQuickCreate';
import { EventModal } from './EventModal';
=======
import { TaskPanel } from '@/components/tasks/TaskPanel';
import { MOCK_TASKS } from '@/data/mockTasks';
import type { Task } from '@/types/task';
import type { CalendarEvent } from '@/types/calendar';
>>>>>>> origin/blocks/jus-25-drag-task-calendar-time-blocking-drop-handler

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

  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);
  const weekEnd = useMemo(() => getWeekEnd(currentDate), [currentDate]);
  const days = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const { timedEvents, allDayEvents } = useWeekEvents(weekStart, weekEnd, visibleCalendarIds);

<<<<<<< HEAD
  // Get the event being edited (if any)
  const editingEvent = selectedEventId
    ? events.find((e) => e.id === selectedEventId) || null
    : null;
=======
  // Combine mock events with created events
  const allTimedEvents = useMemo(() => {
    return [...timedEvents, ...events];
  }, [timedEvents, events]);

  const handleEventCreated = useCallback((event: CalendarEvent) => {
    setEvents((prev) => {
      // If event exists, update it; otherwise add it
      const exists = prev.find((e) => e.id === event.id);
      if (exists) {
        return prev.map((e) => (e.id === event.id ? event : e));
      }
      return [...prev, event];
    });
  }, []);

  const handleTaskUpdated = useCallback((task: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
  }, []);

  const { dragState } = useTaskDrop({
    tasks,
    onEventCreated: handleEventCreated,
    onTaskUpdated: handleTaskUpdated,
  });

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    })
  );
>>>>>>> origin/blocks/jus-25-drag-task-calendar-time-blocking-drop-handler

  return (
    <DndContext sensors={sensors}>
      <div className="flex h-screen overflow-hidden bg-white">
        {/* Task Panel */}
        <TaskPanel tasks={tasks} />

        {/* Calendar Grid */}
        <div className="flex flex-1 flex-col">
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
          <ScrollableGrid
            days={days}
            timedEvents={allTimedEvents}
            today={TODAY}
            dragState={dragState}
          />
        </div>
      </div>
<<<<<<< HEAD

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
=======
    </DndContext>
>>>>>>> origin/blocks/jus-25-drag-task-calendar-time-blocking-drop-handler
  );
}
