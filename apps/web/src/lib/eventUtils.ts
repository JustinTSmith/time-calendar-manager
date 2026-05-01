import { addMinutes, setHours, setMinutes, startOfDay } from 'date-fns';
import { HOUR_HEIGHT } from './constants';

/**
 * Snap a date to the nearest 15-minute interval
 */
export function snapTo15Minutes(date: Date): Date {
  const minutes = date.getMinutes();
  const snappedMinutes = Math.round(minutes / 15) * 15;
  return setMinutes(date, snappedMinutes);
}

/**
 * Calculate time from a click position within a day column
 * @param y - Y coordinate of the click
 * @param containerHeight - Total height of the day column (TOTAL_HEIGHT)
 * @param baseDate - The date for this column
 * @returns Date with the calculated time
 */
export function getTimeFromClick(
  y: number,
  containerHeight: number,
  baseDate: Date
): Date {
  const dayStart = startOfDay(baseDate);
  const hourFraction = y / HOUR_HEIGHT;
  const totalMinutes = hourFraction * 60;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  
  let result = setHours(dayStart, hours);
  result = setMinutes(result, minutes);
  return snapTo15Minutes(result);
}

/**
 * Generate a recurrence rule string based on type
 * Simplified RRULE format
 */
export function generateRecurrenceRule(
  type: 'daily' | 'weekly' | 'monthly',
  startDate: Date
): string {
  const dayOfWeek = startDate.getDay();
  const dayOfMonth = startDate.getDate();
  
  switch (type) {
    case 'daily':
      return 'FREQ=DAILY';
    case 'weekly':
      const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      return `FREQ=WEEKLY;BYDAY=${days[dayOfWeek]}`;
    case 'monthly':
      return `FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth}`;
    default:
      return '';
  }
}

/**
 * Parse a recurrence rule to get a human-readable description
 */
export function getRecurrenceDescription(rule?: string): string {
  if (!rule) return 'Does not repeat';
  
  if (rule.includes('FREQ=DAILY')) return 'Daily';
  if (rule.includes('FREQ=WEEKLY')) return 'Weekly';
  if (rule.includes('FREQ=MONTHLY')) return 'Monthly';
  
  return 'Custom';
}

/**
 * Format a duration in minutes to a readable string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return hours === 1 ? '1 hour' : `${hours} hours`;
  return `${hours}h ${mins}m`;
}

/**
 * Get default event duration (30 minutes)
 */
export function getDefaultDuration(): number {
  return 30;
}

/**
 * Calculate end time from start time and duration
 */
export function calculateEndTime(startAt: Date, durationMinutes: number): Date {
  return addMinutes(startAt, durationMinutes);
}

/**
 * Get duration between two dates in minutes
 */
export function getDurationMinutes(startAt: Date, endAt: Date): number {
  return Math.round((endAt.getTime() - startAt.getTime()) / (1000 * 60));
}
