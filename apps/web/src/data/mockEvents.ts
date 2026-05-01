import { addDays, addMinutes, startOfDay } from 'date-fns';
import type { CalendarEvent, MockCalendar } from '@/types/calendar';
import { getWeekStart } from '@/lib/dateUtils';

export const MOCK_CALENDARS: MockCalendar[] = [
  { id: 'cal-work', name: 'Work', color: '#4285F4' },
  { id: 'cal-personal', name: 'Personal', color: '#34A853' },
];

function h(base: Date, hours: number): Date {
  return addMinutes(base, Math.round(hours * 60));
}

const monday = getWeekStart(new Date());

const tue = addDays(monday, 1);
const wed = addDays(monday, 2);
const thu = addDays(monday, 3);
const fri = addDays(monday, 4);

export const MOCK_EVENTS: CalendarEvent[] = [
  // Monday: two overlapping timed events + a time block
  {
    id: 'e1',
    title: 'Standup',
    startAt: h(monday, 9),
    endAt: h(monday, 9.5),
    calendarId: 'cal-work',
    color: '#4285F4',
    isTimeBlock: false,
    isAllDay: false,
    location: 'Conference Room A',
    description: 'Daily team standup meeting',
    attendees: [
      { email: 'alice@example.com', name: 'Alice', status: 'accepted' },
      { email: 'bob@example.com', name: 'Bob', status: 'accepted' },
    ],
  },
  {
    id: 'e2',
    title: 'Design Review',
    startAt: h(monday, 9.25),
    endAt: h(monday, 10.5),
    calendarId: 'cal-work',
    color: '#4285F4',
    isTimeBlock: false,
    isAllDay: false,
    location: 'Zoom',
    videoConferencing: 'zoom',
  },
  {
    id: 'e3',
    title: 'Deep Work',
    startAt: h(monday, 14),
    endAt: h(monday, 16),
    calendarId: 'cal-work',
    color: '#EA4335',
    isTimeBlock: true,
    isAllDay: false,
  },
  // Tuesday: all-day event
  {
    id: 'e4',
    title: 'Team Offsite',
    startAt: startOfDay(tue),
    endAt: startOfDay(addDays(tue, 1)),
    calendarId: 'cal-work',
    color: '#4285F4',
    isTimeBlock: false,
    isAllDay: true,
    location: 'Offsite Venue',
  },
  {
    id: 'e5',
    title: '1:1 with Manager',
    startAt: h(tue, 11),
    endAt: h(tue, 11.5),
    calendarId: 'cal-work',
    color: '#4285F4',
    isTimeBlock: false,
    isAllDay: false,
    reminders: [{ method: 'notification', minutesBefore: 10 }],
  },
  // Wednesday: triple overlap — tests the column algorithm
  {
    id: 'e6',
    title: 'Call A',
    startAt: h(wed, 10),
    endAt: h(wed, 11),
    calendarId: 'cal-personal',
    color: '#34A853',
    isTimeBlock: false,
    isAllDay: false,
  },
  {
    id: 'e7',
    title: 'Call B',
    startAt: h(wed, 10.5),
    endAt: h(wed, 11.5),
    calendarId: 'cal-personal',
    color: '#34A853',
    isTimeBlock: false,
    isAllDay: false,
  },
  {
    id: 'e8',
    title: 'Call C',
    startAt: h(wed, 10.75),
    endAt: h(wed, 12),
    calendarId: 'cal-work',
    color: '#4285F4',
    isTimeBlock: false,
    isAllDay: false,
  },
  // Thursday: short event to test MIN_EVENT_HEIGHT clamp
  {
    id: 'e9',
    title: 'Quick Sync',
    startAt: h(thu, 11),
    endAt: h(thu, 11.25),
    calendarId: 'cal-work',
    color: '#4285F4',
    isTimeBlock: false,
    isAllDay: false,
  },
  // Thursday: recurring weekly lunch
  {
    id: 'e10',
    title: 'Lunch',
    startAt: h(thu, 12),
    endAt: h(thu, 13),
    calendarId: 'cal-personal',
    color: '#34A853',
    isTimeBlock: false,
    isAllDay: false,
    recurrenceRule: 'FREQ=WEEKLY;BYDAY=TH',
    recurrenceType: 'weekly',
  },
  // Friday: a longer block
  {
    id: 'e11',
    title: 'Sprint Planning',
    startAt: h(fri, 10),
    endAt: h(fri, 12),
    calendarId: 'cal-work',
    color: '#4285F4',
    isTimeBlock: false,
    isAllDay: false,
    location: 'Conference Room B',
    description: 'Weekly sprint planning with the team',
    videoConferencing: 'google-meet',
    attendees: [
      { email: 'team@example.com', name: 'Engineering Team', status: 'needsAction' },
    ],
  },
  {
    id: 'e12',
    title: 'Weekend prep',
    startAt: h(fri, 16),
    endAt: h(fri, 16.5),
    calendarId: 'cal-personal',
    color: '#34A853',
    isTimeBlock: false,
    isAllDay: false,
  },
];
