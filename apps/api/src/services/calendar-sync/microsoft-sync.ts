import { eq, and, inArray } from 'drizzle-orm';
import { db, calendarAccounts, calendars, events } from '../../lib/db.js';
import { getValidAccessToken } from '../token-manager.js';
import { 
  getCalendars, 
  getEvents, 
  getDeltaEvents,
  MicrosoftEvent,
  MicrosoftCalendar,
  convertRecurrenceToRRULE 
} from '../microsoft/microsoft-graph.js';
import { syncQueue } from '../../lib/queue.js';

interface SyncResult {
  calendarsAdded: number;
  calendarsUpdated: number;
  eventsAdded: number;
  eventsUpdated: number;
  eventsDeleted: number;
}

/**
 * Perform full sync for a Microsoft account
 * Fetches all calendars and events, upserts them to the database
 */
export async function performFullSync(accountId: string): Promise<SyncResult> {
  const result: SyncResult = {
    calendarsAdded: 0,
    calendarsUpdated: 0,
    eventsAdded: 0,
    eventsUpdated: 0,
    eventsDeleted: 0,
  };

  const account = await db.query.calendarAccounts.findFirst({
    where: eq(calendarAccounts.id, accountId),
    with: {
      calendars: true,
    },
  });

  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  const accessToken = await getValidAccessToken(accountId);

  // Get all calendars from Microsoft
  const msCalendars = await getCalendars(accessToken);

  // Map existing calendars by provider ID
  const existingCalendars = new Map(account.calendars.map(c => [c.providerCalendarId, c]));

  // Process each calendar
  for (const msCalendar of msCalendars) {
    const existing = existingCalendars.get(msCalendar.id);
    let calendarId: string;

    if (existing) {
      // Update existing calendar
      await db.update(calendars)
        .set({
          name: msCalendar.name,
          isPrimary: msCalendar.isDefaultCalendar,
          updatedAt: new Date(),
        })
        .where(eq(calendars.id, existing.id));
      calendarId = existing.id;
      result.calendarsUpdated++;
    } else {
      // Create new calendar
      const [newCalendar] = await db.insert(calendars).values({
        accountId,
        providerCalendarId: msCalendar.id,
        name: msCalendar.name,
        isPrimary: msCalendar.isDefaultCalendar,
        isVisible: true,
      }).returning({ id: calendars.id });
      calendarId = newCalendar.id;
      result.calendarsAdded++;
    }

    // Sync events for this calendar
    const eventResult = await syncCalendarEvents(accessToken, account.userId, calendarId, msCalendar.id);
    result.eventsAdded += eventResult.added;
    result.eventsUpdated += eventResult.updated;
  }

  // Get delta token for future incremental syncs
  const firstCalendar = msCalendars[0];
  if (firstCalendar) {
    const deltaResponse = await getDeltaEvents(accessToken, firstCalendar.id);
    if (deltaResponse.deltaToken) {
      await db.update(calendarAccounts)
        .set({
          syncCursor: deltaResponse.deltaToken,
          updatedAt: new Date(),
        })
        .where(eq(calendarAccounts.id, accountId));
    }
  }

  return result;
}

/**
 * Sync all events from a calendar
 */
async function syncCalendarEvents(
  accessToken: string,
  userId: string,
  calendarId: string,
  providerCalendarId: string
): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;

  // Get existing events
  const existingEvents = await db.query.events.findMany({
    where: eq(events.calendarId, calendarId),
  });
  const existingEventMap = new Map(existingEvents.map(e => [e.providerEventId, e]));

  // Get all events from Microsoft
  const msEvents = await getEvents(accessToken, providerCalendarId, {
    top: 100,
    select: ['id', 'subject', 'body', 'start', 'end', 'isAllDay', 'recurrence', 'attendees', 'location', 'isCancelled', 'createdDateTime', 'lastModifiedDateTime', 'categories', 'sensitivity'],
  });

  for (const msEvent of msEvents) {
    const existing = existingEventMap.get(msEvent.id);
    const eventData = transformMicrosoftEvent(userId, calendarId, msEvent);

    if (existing) {
      // Check if event needs updating
      const lastModified = new Date(msEvent.lastModifiedDateTime);
      if (lastModified > (existing.updatedAt || existing.createdAt)) {
        await db.update(events)
          .set({
            ...eventData,
            updatedAt: new Date(),
          })
          .where(eq(events.id, existing.id));
        updated++;
      }
    } else {
      // Create new event
      await db.insert(events).values(eventData);
      added++;
    }
  }

  return { added, updated };
}

/**
 * Perform incremental sync using delta tokens
 */
export async function performIncrementalSync(accountId: string): Promise<SyncResult> {
  const result: SyncResult = {
    calendarsAdded: 0,
    calendarsUpdated: 0,
    eventsAdded: 0,
    eventsUpdated: 0,
    eventsDeleted: 0,
  };

  const account = await db.query.calendarAccounts.findFirst({
    where: eq(calendarAccounts.id, accountId),
    with: {
      calendars: true,
    },
  });

  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  if (!account.syncCursor) {
    // No delta token, perform full sync instead
    return performFullSync(accountId);
  }

  const accessToken = await getValidAccessToken(accountId);

  // Process each calendar
  for (const calendar of account.calendars) {
    const deltaResult = await syncCalendarDelta(
      accessToken,
      account.userId,
      calendar.id,
      calendar.providerCalendarId,
      account.syncCursor
    );

    result.eventsAdded += deltaResult.added;
    result.eventsUpdated += deltaResult.updated;
    result.eventsDeleted += deltaResult.deleted;

    // Update delta token if we got a new one
    if (deltaResult.newDeltaToken) {
      await db.update(calendarAccounts)
        .set({
          syncCursor: deltaResult.newDeltaToken,
          updatedAt: new Date(),
        })
        .where(eq(calendarAccounts.id, accountId));
    }
  }

  return result;
}

/**
 * Sync calendar using delta query
 */
async function syncCalendarDelta(
  accessToken: string,
  userId: string,
  calendarId: string,
  providerCalendarId: string,
  deltaToken: string
): Promise<{ added: number; updated: number; deleted: number; newDeltaToken: string | null }> {
  let added = 0;
  let updated = 0;
  let deleted = 0;

  const deltaResponse = await getDeltaEvents(accessToken, providerCalendarId, deltaToken);

  for (const msEvent of deltaResponse.events) {
    // Check if this is a deletion
    if (msEvent.isCancelled) {
      // Soft delete the event
      const existing = await db.query.events.findFirst({
        where: and(
          eq(events.calendarId, calendarId),
          eq(events.providerEventId, msEvent.id)
        ),
      });

      if (existing) {
        await db.update(events)
          .set({
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(events.id, existing.id));
        deleted++;
      }
      continue;
    }

    // Check if event exists
    const existing = await db.query.events.findFirst({
      where: and(
        eq(events.calendarId, calendarId),
        eq(events.providerEventId, msEvent.id)
      ),
    });

    const eventData = transformMicrosoftEvent(userId, calendarId, msEvent);

    if (existing) {
      await db.update(events)
        .set({
          ...eventData,
          deletedAt: null, // Restore if previously deleted
          updatedAt: new Date(),
        })
        .where(eq(events.id, existing.id));
      updated++;
    } else {
      await db.insert(events).values(eventData);
      added++;
    }
  }

  return {
    added,
    updated,
    deleted,
    newDeltaToken: deltaResponse.deltaToken,
  };
}

/**
 * Transform Microsoft Graph event to database schema
 */
function transformMicrosoftEvent(
  userId: string,
  calendarId: string,
  msEvent: MicrosoftEvent
): {
  userId: string;
  calendarId: string;
  providerEventId: string;
  title: string;
  startAt: Date;
  endAt: Date;
  recurrenceRule: string | null;
  attendees: Array<{ name: string; email: string; response: string }>;
  reminders: unknown[];
  isTimeBlock: boolean;
  deletedAt: null;
  createdAt: Date;
} {
  // Parse start and end times
  const startAt = parseMicrosoftDateTime(msEvent.start);
  const endAt = parseMicrosoftDateTime(msEvent.end);

  // Convert recurrence to RRULE
  const recurrenceRule = msEvent.recurrence 
    ? convertRecurrenceToRRULE(msEvent.recurrence) 
    : null;

  // Transform attendees
  const attendees = msEvent.attendees?.map(attendee => ({
    name: attendee.emailAddress.name,
    email: attendee.emailAddress.address,
    response: attendee.status.response,
  })) || [];

  return {
    userId,
    calendarId,
    providerEventId: msEvent.id,
    title: msEvent.subject || '(No title)',
    startAt,
    endAt,
    recurrenceRule,
    attendees,
    reminders: [], // TODO: Parse Microsoft reminders
    isTimeBlock: false,
    deletedAt: null,
    createdAt: new Date(msEvent.createdDateTime),
  };
}

/**
 * Parse Microsoft date/time object to JavaScript Date
 */
function parseMicrosoftDateTime(dateTimeObj: { dateTime: string; timeZone: string }): Date {
  // Microsoft returns dateTime in ISO 8601 format
  return new Date(dateTimeObj.dateTime);
}

/**
 * Queue an incremental sync for an account
 */
export async function queueIncrementalSync(accountId: string): Promise<void> {
  const account = await db.query.calendarAccounts.findFirst({
    where: eq(calendarAccounts.id, accountId),
  });

  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  await syncQueue.add('microsoft-incremental-sync', {
    accountId,
    userId: account.userId,
  }, {
    jobId: `incremental-sync-${accountId}-${Date.now()}`,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });
}
