export type CalendarView = 'day' | 'week' | 'month';

export interface CalendarEvent {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  calendarId: string;
  color: string;
  isTimeBlock: boolean;
  isAllDay: boolean;
}

export interface PositionedEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  left: number;
  width: number;
  columnIndex: number;
  columnCount: number;
}

export interface MockCalendar {
  id: string;
  name: string;
  color: string;
}
