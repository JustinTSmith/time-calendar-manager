import { isSameDay, endOfDay, startOfDay, differenceInMinutes } from 'date-fns';
import type { CalendarEvent, PositionedEvent } from '@/types/calendar';
import { HOUR_HEIGHT, MIN_EVENT_HEIGHT } from './constants';

interface EventWithSlot {
  event: CalendarEvent;
  effectiveStart: Date;
  effectiveEnd: Date;
  col: number;
  groupSize: number;
}

function getEffectiveTimes(event: CalendarEvent, day: Date): { start: Date; end: Date } {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  return {
    start: event.startAt < dayStart ? dayStart : event.startAt,
    end: event.endAt > dayEnd ? dayEnd : event.endAt,
  };
}

function buildGroups(events: CalendarEvent[], day: Date): CalendarEvent[][] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => {
    const diff = a.startAt.getTime() - b.startAt.getTime();
    return diff !== 0 ? diff : b.endAt.getTime() - a.endAt.getTime();
  });

  const groups: CalendarEvent[][] = [];
  let currentGroup: CalendarEvent[] = [];
  let groupEndMax: Date | null = null;

  for (const event of sorted) {
    const { start, end } = getEffectiveTimes(event, day);

    if (groupEndMax === null || start >= groupEndMax) {
      if (currentGroup.length > 0) groups.push(currentGroup);
      currentGroup = [event];
      groupEndMax = end;
    } else {
      currentGroup.push(event);
      if (end > groupEndMax) groupEndMax = end;
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  return groups;
}

function assignColumns(group: CalendarEvent[], day: Date): EventWithSlot[] {
  const colEnds: Date[] = [];
  const result: EventWithSlot[] = [];

  for (const event of group) {
    const { start, end } = getEffectiveTimes(event, day);
    let col = colEnds.findIndex((colEnd) => colEnd <= start);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(end);
    } else {
      colEnds[col] = end;
    }
    result.push({ event, effectiveStart: start, effectiveEnd: end, col, groupSize: 0 });
  }

  const totalCols = colEnds.length;
  for (const slot of result) {
    slot.groupSize = totalCols;
  }

  return result;
}

export function computePositionedEvents(
  allEvents: CalendarEvent[],
  day: Date,
): PositionedEvent[] {
  const timedDayEvents = allEvents.filter(
    (e) => !e.isAllDay && isSameDay(e.startAt, day),
  );

  if (timedDayEvents.length === 0) return [];

  const groups = buildGroups(timedDayEvents, day);
  const positioned: PositionedEvent[] = [];

  for (const group of groups) {
    const slots = assignColumns(group, day);

    for (const slot of slots) {
      const dayStart = startOfDay(day);
      const startMin = differenceInMinutes(slot.effectiveStart, dayStart);
      const durationMin = differenceInMinutes(slot.effectiveEnd, slot.effectiveStart);

      const top = (startMin / 60) * HOUR_HEIGHT;
      const height = Math.max((durationMin / 60) * HOUR_HEIGHT, MIN_EVENT_HEIGHT);
      const left = slot.col / slot.groupSize;
      const width = 1 / slot.groupSize;

      positioned.push({
        event: slot.event,
        top,
        height,
        left,
        width,
        columnIndex: slot.col,
        columnCount: slot.groupSize,
      });
    }
  }

  return positioned;
}
