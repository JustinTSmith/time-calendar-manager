export type CalendarProvider = 'google' | 'microsoft' | 'icloud' | 'caldav';

export interface CalendarDto {
  id: string;
  name: string;
  color: string | null;
  isPrimary: boolean;
  isVisible: boolean;
}

export interface CalendarAccountDto {
  id: string;
  provider: CalendarProvider;
  email: string | null;
  status: string;
  calendars: CalendarDto[];
}

export interface CalendarSetDto {
  id: string;
  name: string;
  calendarIds: string[];
}

export interface GetCalendarsResponse {
  accounts: CalendarAccountDto[];
  calendarSets: CalendarSetDto[];
}

export interface PatchCalendarBody {
  is_visible?: boolean;
  color?: string;
}

export type PatchCalendarResponse = CalendarDto;
