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
import { EventQuickCreate } from './EventQuickCreate';
import { EventModal } from './EventModal';
import { TaskPanel } from '@/components/tasks/TaskPanel';
import { MOCK_TASKS } from '@/data/mockTasks';
import type { Task } from '@/types/task';
import type { CalendarEvent } from '@/types/calendar';

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
  const [localEvents, setLocalEvents] = useState<CalendarEvent[]>([]);

  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);
  const weekEnd = useMemo(() => getWeekEnd(currentDate), [currentDate]);
  const days = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const { timedEvents, allDayEvents } = useWeekEvents(weekStart, weekEnd, visibleCalendarIds);

  const editingEvent = selectedEventId
    ? events.find((e) => e.id === selectedEventId) || null
    : null;

  const allTimedEvents = useMemo(() => {
    return [...timedEvents, ...localEvents];
  }, [timedEvents, localEvents]);

  const handleEventCreated = useCallback((event: CalendarEvent) => {
    setLocalEvents((prev) => {
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  return (
    <DndContext sensors={sensors}>
      <div className="flex h-screen overflow-hidden bg-white">
        <TaskPanel tasks={tasks} />

        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 shrink-0">
            <WeekNavBar
              currentDate={currentDate}
              onPrev={goToPrevWeek}
              onNext={goToNextWeek}
              onToday={goToToday}
            />
            <ViewToggle current={view} onChange={setView} />
          </div>

          <WeekHeader days={days} today={TODAY} />

          <AllDayZone days={days} allDayEvents={allDayEvents} />

          <ScrollableGrid
            days={days}
            timedEvents={allTimedEvents}
            today={TODAY}
            dragState={dragState}
          />
        </div>
      </div>

      <EventQuickCreate />
      <EventModal event={editingEvent} draftEvent={draftEvent} />
    </DndContext>
  );
}
