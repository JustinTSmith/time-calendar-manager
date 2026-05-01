export type CalendarView = 'day' | 'week' | 'month';

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';

export interface Attendee {
  email: string;
  name?: string;
  status?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
}

export interface Reminder {
  method: 'email' | 'notification';
  minutesBefore: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  calendarId: string;
  color: string;
  isTimeBlock: boolean;
  isAllDay: boolean;
  // Extended fields for full event modal
  location?: string;
  description?: string;
  recurrenceRule?: string;
  recurrenceType?: RecurrenceType;
  attendees?: Attendee[];
  reminders?: Reminder[];
  videoConferencing?: 'google-meet' | 'zoom' | null;
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
