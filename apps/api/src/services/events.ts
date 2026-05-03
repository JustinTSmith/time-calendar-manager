import { and, eq, isNull, lt, gt, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { RRule } from 'rrule';
import { db, events, calendars } from '@time-calendar-manager/db';
import { ApiError } from '../lib/errors.js';
import type { CreateEventInput, UpdateEventInput, DuplicateEventInput, DeleteScope } from '../schemas/events.js';

async function assertCalendarOwnership(calendarId: string, userId: string): Promise<void> {
  const calendar = await db.query.calendars.findFirst({
    where: eq(calendars.id, calendarId),
    with: { account: { columns: { userId: true } } },
  });

  if (!calendar || calendar.account.userId !== userId) {
    throw new ApiError(403, 'FORBIDDEN', 'Calendar does not belong to this user');
  }
}

async function assertEventOwnership(eventId: string, userId: string) {
  const event = await db.query.events.findFirst({
    where: and(eq(events.id, eventId), isNull(events.deletedAt)),
  });

  if (!event) {
    throw new ApiError(404, 'NOT_FOUND', 'Event not found');
  }

  if (event.userId !== userId) {
    throw new ApiError(403, 'FORBIDDEN', 'Event does not belong to this user');
  }

  return event;
}

function expandRecurringEvent(
  event: typeof events.$inferSelect,
  rangeStart: Date,
  rangeEnd: Date,
): Array<typeof events.$inferSelect & { virtualId?: string }> {
  if (!event.recurrenceRule) return [event];

  try {
    const rule = RRule.fromString(event.recurrenceRule);
    const occurrences = rule.between(rangeStart, rangeEnd, true);
    const duration = event.endAt.getTime() - event.startAt.getTime();

    return occurrences.map((occStart, idx) => ({
      ...event,
      startAt: occStart,
      endAt: new Date(occStart.getTime() + duration),
      virtualId: idx === 0 ? event.id : `${event.id}_${occStart.toISOString()}`,
    }));
  } catch {
    return [event];
  }
}

export async function getUserEvents(
  userId: string,
  start: Date,
  end: Date,
  calendarIds?: string[],
) {
  const conditions = [
    eq(events.userId, userId),
    isNull(events.deletedAt),
    lt(events.startAt, end),
    gt(events.endAt, start),
  ];

  if (calendarIds && calendarIds.length > 0) {
    conditions.push(inArray(events.calendarId, calendarIds));
  }

  const rows = await db.query.events.findMany({
    where: and(...conditions),
  });

  return rows.flatMap((event) => expandRecurringEvent(event, start, end));
}

export async function createEvent(userId: string, data: CreateEventInput) {
  await assertCalendarOwnership(data.calendar_id, userId);

  const startAt = data.start_at ? new Date(data.start_at) : new Date();
  const endAt = data.end_at ? new Date(data.end_at) : new Date();

  const [created] = await db
    .insert(events)
    .values({
      userId,
      calendarId: data.calendar_id,
      providerEventId: `local_${randomUUID()}`,
      title: data.title,
      startAt,
      endAt,
      isAllDay: data.is_all_day ?? false,
      recurrenceRule: data.recurrence_rule ?? null,
      attendees: data.attendees ?? [],
      reminders: data.reminders ?? [],
    })
    .returning();

  return created;
}

export async function getEventById(userId: string, eventId: string) {
  return assertEventOwnership(eventId, userId);
}

export async function updateEvent(userId: string, eventId: string, data: UpdateEventInput) {
  const event = await assertEventOwnership(eventId, userId);

  const updateData: Partial<typeof events.$inferInsert> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.start_at !== undefined) updateData.startAt = new Date(data.start_at);
  if (data.end_at !== undefined) updateData.endAt = new Date(data.end_at);
  if (data.is_all_day !== undefined) updateData.isAllDay = data.is_all_day;
  if (data.recurrence_rule !== undefined) updateData.recurrenceRule = data.recurrence_rule;
  if (data.attendees !== undefined) updateData.attendees = data.attendees;
  if (data.reminders !== undefined) updateData.reminders = data.reminders;

  const [updated] = await db
    .update(events)
    .set(updateData)
    .where(eq(events.id, event.id))
    .returning();

  return updated;
}

export async function deleteEvent(userId: string, eventId: string, scope: DeleteScope) {
  const event = await assertEventOwnership(eventId, userId);
  const now = new Date();

  if (scope === 'all') {
    await db
      .update(events)
      .set({ deletedAt: now })
      .where(eq(events.id, event.id));
    return;
  }

  if (scope === 'this_and_following' && event.recurrenceRule) {
    try {
      const rule = RRule.fromString(event.recurrenceRule);
      const options = rule.origOptions;
      // Truncate the recurrence to end before this occurrence
      const until = new Date(event.startAt.getTime() - 1000);
      options.until = until;
      delete options.count;
      const truncated = new RRule(options);
      await db
        .update(events)
        .set({ recurrenceRule: truncated.toString(), deletedAt: now })
        .where(eq(events.id, event.id));
      return;
    } catch {
      // Fall through to soft-delete if RRULE parsing fails
    }
  }

  await db
    .update(events)
    .set({ deletedAt: now })
    .where(eq(events.id, event.id));
}

export async function duplicateEvent(userId: string, eventId: string, data: DuplicateEventInput) {
  const event = await assertEventOwnership(eventId, userId);

  const targetCalendarId = data.target_calendar_id ?? event.calendarId;
  if (data.target_calendar_id) {
    await assertCalendarOwnership(data.target_calendar_id, userId);
  }

  const title = data.title_prefix ? `${data.title_prefix}${event.title}` : event.title;

  const [duplicate] = await db
    .insert(events)
    .values({
      userId,
      calendarId: targetCalendarId,
      providerEventId: `local_${randomUUID()}`,
      title,
      startAt: event.startAt,
      endAt: event.endAt,
      isAllDay: event.isAllDay,
      recurrenceRule: event.recurrenceRule,
      attendees: event.attendees,
      reminders: event.reminders,
      isTimeBlock: event.isTimeBlock,
    })
    .returning();

  return duplicate;
}
