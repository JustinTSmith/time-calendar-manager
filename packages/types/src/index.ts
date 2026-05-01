// Re-export types from the database schema
export type {
  users,
  calendarAccounts,
  calendars,
  taskLists,
  events,
  tasks,
  calendarSets,
  refreshTokens,
  // Relations
  usersRelations,
  calendarAccountsRelations,
  calendarsRelations,
  taskListsRelations,
  tasksRelations,
  eventsRelations,
  calendarSetsRelations,
  refreshTokensRelations,
} from '@time-calendar-manager/db';

// Infer types from schema
import type {
  users,
  calendarAccounts,
  calendars,
  taskLists,
  events,
  tasks,
  calendarSets,
} from '@time-calendar-manager/db';

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type CalendarAccount = typeof calendarAccounts.$inferSelect;
export type NewCalendarAccount = typeof calendarAccounts.$inferInsert;

export type Calendar = typeof calendars.$inferSelect;
export type NewCalendar = typeof calendars.$inferInsert;

export type TaskList = typeof taskLists.$inferSelect;
export type NewTaskList = typeof taskLists.$inferInsert;

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export type CalendarSet = typeof calendarSets.$inferSelect;
export type NewCalendarSet = typeof calendarSets.$inferInsert;

// Socket event payload types
export interface EventCreatedPayload {
  calendarId: string;
  eventId: string;
}

export interface EventUpdatedPayload {
  eventId: string;
}

export interface EventDeletedPayload {
  eventId: string;
}

export interface TaskUpdatedPayload {
  taskId: string;
}

export interface CalendarSyncCompletePayload {
  accountId: string;
}

// Socket event names (for type-safe usage)
export const SocketEvents = {
  EVENT_CREATED: 'event:created',
  EVENT_UPDATED: 'event:updated',
  EVENT_DELETED: 'event:deleted',
  TASK_UPDATED: 'task:updated',
  CALENDAR_SYNC_COMPLETE: 'calendar:sync_complete',
} as const;

export type SocketEventName = typeof SocketEvents[keyof typeof SocketEvents];

// API response types
export interface ApiError {
  error: string;
}

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
}
