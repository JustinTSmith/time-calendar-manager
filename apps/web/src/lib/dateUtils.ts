import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addWeeks,
  subWeeks,
  isSameMonth,
} from 'date-fns';

const WEEK_OPTIONS = { weekStartsOn: 1 } as const; // Monday

export function getWeekStart(date: Date): Date {
  return startOfWeek(date, WEEK_OPTIONS);
}

export function getWeekEnd(date: Date): Date {
  return endOfWeek(date, WEEK_OPTIONS);
}

export function getWeekDays(date: Date): Date[] {
  return eachDayOfInterval({
    start: getWeekStart(date),
    end: getWeekEnd(date),
  });
}

export function formatWeekRangeLabel(date: Date): string {
  const start = getWeekStart(date);
  const end = getWeekEnd(date);

  if (isSameMonth(start, end)) {
    return `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`;
  }
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
}

export function prevWeek(date: Date): Date {
  return subWeeks(date, 1);
}

export function nextWeek(date: Date): Date {
  return addWeeks(date, 1);
}
