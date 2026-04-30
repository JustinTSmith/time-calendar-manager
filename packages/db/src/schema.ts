import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const tableId = () => uuid('id').defaultRandom().primaryKey();
const createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull();

export const users = pgTable(
  'users',
  {
    id: tableId(),
    email: varchar('email', { length: 320 }).notNull(),
    name: text('name').notNull(),
    timezone: varchar('timezone', { length: 100 }).notNull().default('UTC'),
    workingHours: jsonb('working_hours').notNull().default(sql`'{}'::jsonb`),
    preferences: jsonb('preferences').notNull().default(sql`'{}'::jsonb`),
    plan: varchar('plan', { length: 50 }).notNull().default('free'),
    stripeCustomerId: text('stripe_customer_id'),
    createdAt,
  },
  (table) => [
    uniqueIndex('users_email_idx').on(table.email),
    uniqueIndex('users_stripe_customer_id_idx').on(table.stripeCustomerId),
  ],
);

export const calendarAccounts = pgTable(
  'calendar_accounts',
  {
    id: tableId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 50 }).notNull(),
    accessTokenEncrypted: text('access_token_encrypted').notNull(),
    refreshTokenEncrypted: text('refresh_token_encrypted').notNull(),
    syncCursor: text('sync_cursor'),
    status: varchar('status', { length: 50 }).notNull().default('active'),
    createdAt,
  },
  (table) => [index('calendar_accounts_user_id_idx').on(table.userId)],
);

export const calendars = pgTable(
  'calendars',
  {
    id: tableId(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => calendarAccounts.id, { onDelete: 'cascade' }),
    providerCalendarId: text('provider_calendar_id').notNull(),
    name: text('name').notNull(),
    color: varchar('color', { length: 20 }),
    isPrimary: boolean('is_primary').notNull().default(false),
    isVisible: boolean('is_visible').notNull().default(true),
    createdAt,
  },
  (table) => [
    index('calendars_account_id_idx').on(table.accountId),
    uniqueIndex('calendars_account_provider_calendar_idx').on(table.accountId, table.providerCalendarId),
  ],
);

export const taskLists = pgTable(
  'task_lists',
  {
    id: tableId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: varchar('color', { length: 20 }),
    isInbox: boolean('is_inbox').notNull().default(false),
    createdAt,
  },
  (table) => [index('task_lists_user_id_idx').on(table.userId)],
);

export const events = pgTable(
  'events',
  {
    id: tableId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    calendarId: uuid('calendar_id')
      .notNull()
      .references(() => calendars.id, { onDelete: 'cascade' }),
    providerEventId: text('provider_event_id').notNull(),
    title: text('title').notNull(),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    recurrenceRule: text('recurrence_rule'),
    attendees: jsonb('attendees').notNull().default(sql`'[]'::jsonb`),
    reminders: jsonb('reminders').notNull().default(sql`'[]'::jsonb`),
    isTimeBlock: boolean('is_time_block').notNull().default(false),
    taskId: uuid('task_id'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt,
  },
  (table) => [
    index('events_calendar_id_idx').on(table.calendarId),
    index('events_user_id_start_at_end_at_idx').on(table.userId, table.startAt, table.endAt),
    uniqueIndex('events_calendar_provider_event_idx').on(table.calendarId, table.providerEventId),
  ],
);

export const tasks = pgTable(
  'tasks',
  {
    id: tableId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    listId: uuid('list_id').references(() => taskLists.id, { onDelete: 'set null' }),
    source: varchar('source', { length: 50 }).notNull().default('manual'),
    title: text('title').notNull(),
    notes: text('notes'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    durationMinutes: integer('duration_minutes').notNull().default(30),
    priority: integer('priority').notNull().default(3),
    status: varchar('status', { length: 50 }).notNull().default('inbox'),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    scheduledEventId: uuid('scheduled_event_id').references(() => events.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt,
  },
  (table) => [
    index('tasks_user_id_status_idx').on(table.userId, table.status),
    index('tasks_user_id_due_date_idx').on(table.userId, table.dueDate),
    index('tasks_list_id_idx').on(table.listId),
    uniqueIndex('tasks_scheduled_event_id_idx').on(table.scheduledEventId),
  ],
);

export const calendarSets = pgTable(
  'calendar_sets',
  {
    id: tableId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    calendarIds: uuid('calendar_ids').array().notNull().default(sql`'{}'::uuid[]`),
    createdAt,
  },
  (table) => [index('calendar_sets_user_id_idx').on(table.userId)],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: tableId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt,
  },
  (table) => [
    index('refresh_tokens_user_id_idx').on(table.userId),
    uniqueIndex('refresh_tokens_token_hash_idx').on(table.tokenHash),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  calendarAccounts: many(calendarAccounts),
  calendarSets: many(calendarSets),
  events: many(events),
  refreshTokens: many(refreshTokens),
  taskLists: many(taskLists),
  tasks: many(tasks),
}));

export const calendarAccountsRelations = relations(calendarAccounts, ({ one, many }) => ({
  user: one(users, {
    fields: [calendarAccounts.userId],
    references: [users.id],
  }),
  calendars: many(calendars),
}));

export const calendarsRelations = relations(calendars, ({ one, many }) => ({
  account: one(calendarAccounts, {
    fields: [calendars.accountId],
    references: [calendarAccounts.id],
  }),
  events: many(events),
}));

export const taskListsRelations = relations(taskLists, ({ one, many }) => ({
  user: one(users, {
    fields: [taskLists.userId],
    references: [users.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  user: one(users, {
    fields: [tasks.userId],
    references: [users.id],
  }),
  list: one(taskLists, {
    fields: [tasks.listId],
    references: [taskLists.id],
  }),
  scheduledEvent: one(events, {
    fields: [tasks.scheduledEventId],
    references: [events.id],
  }),
  linkedEvents: many(events),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  user: one(users, {
    fields: [events.userId],
    references: [users.id],
  }),
  calendar: one(calendars, {
    fields: [events.calendarId],
    references: [calendars.id],
  }),
  task: one(tasks, {
    fields: [events.taskId],
    references: [tasks.id],
  }),
}));

export const calendarSetsRelations = relations(calendarSets, ({ one }) => ({
  user: one(users, {
    fields: [calendarSets.userId],
    references: [users.id],
  }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));
