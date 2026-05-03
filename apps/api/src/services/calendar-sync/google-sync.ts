import { calendar_v3 } from 'googleapis';
import { db, calendars, events, calendarAccounts } from '@time-calendar-manager/db';
import { eq, and, sql } from 'drizzle-orm';
import { emitEventCreated, emitEventUpdated, emitEventDeleted } from '../../lib/socket.js';
import { setupChannelRenewalJob } from '../../lib/queue.js';
import { env } from '../../config/env.js';
import { randomUUID } from 'crypto';
import { createCalendarClientFromEncrypted } from '../../lib/google-client.js';

export interface SyncContext {
  accountId: string;
  userId: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
}

interface CalendarListEntry {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
}

interface EventItem {
  id?: string | null;
  summary?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
  recurrence?: string[] | null;
  attendees?: { email?: string | null }[] | null;
  reminders?: {
    overrides?: { method?: string | null; minutes?: number | null }[] | null;
  } | null;
  status?: string | null;
  updated?: string | null;
}

async function getOrCreateCalendar(
  accountId: string,
  providerCalendar: CalendarListEntry
): Promise<string> {
  const existing = await db.query.calendars.findFirst({
    where: and(
      eq(calendars.accountId, accountId),
      eq(calendars.providerCalendarId, providerCalendar.id)
    ),
  });

  if (existing) {
    // Update if needed
    if (existing.name !== providerCalendar.summary || existing.isPrimary !== !!providerCalendar.primary) {
      await db
        .update(calendars)
        .set({
          name: providerCalendar.summary,
          isPrimary: !!providerCalendar.primary,
          color: providerCalendar.backgroundColor || existing.color,
        })
        .where(eq(calendars.id, existing.id));
    }
    return existing.id;
  }

  // Create new calendar
  const [newCalendar] = await db
    .insert(calendars)
    .values({
      accountId,
      providerCalendarId: providerCalendar.id,
      name: providerCalendar.summary,
      isPrimary: !!providerCalendar.primary,
      color: providerCalendar.backgroundColor,
      isVisible: true,
    })
    .returning();

  return newCalendar.id;
}

async function upsertEvent(
  userId: string,
  calendarId: string,
  providerEvent: EventItem,
  emitSocket: boolean = false
): Promise<void> {
  const providerEventId = providerEvent.id;
  if (!providerEventId) {
    console.warn('Event has no provider ID, skipping');
    return;
  }

  const title = providerEvent.summary || '(No title)';
  
  // Parse start/end times
  let startAt: Date;
  let endAt: Date;
  
  if (providerEvent.start?.dateTime) {
    startAt = new Date(providerEvent.start.dateTime);
  } else if (providerEvent.start?.date) {
    // All-day event
    startAt = new Date(providerEvent.start.date + 'T00:00:00');
  } else {
    console.warn(`Event ${providerEventId} has no start time, skipping`);
    return;
  }

  if (providerEvent.end?.dateTime) {
    endAt = new Date(providerEvent.end.dateTime);
  } else if (providerEvent.end?.date) {
    // All-day event ends next day
    endAt = new Date(providerEvent.end.date + 'T00:00:00');
  } else {
    endAt = new Date(startAt.getTime() + 30 * 60 * 1000); // Default 30 min
  }

  // Parse attendees
  const attendees = providerEvent.attendees
    ?.map(a => a.email)
    .filter((e): e is string => !!e) || [];

  // Parse reminders
  const reminders = providerEvent.reminders?.overrides?.map(r => ({
    method: r.method || 'popup',
    minutes: r.minutes || 10,
  })) || [];

  // Check if event exists
  const existing = await db.query.events.findFirst({
    where: and(
      eq(events.calendarId, calendarId),
      eq(events.providerEventId, providerEventId)
    ),
  });

  if (existing) {
    // Update existing event
    await db
      .update(events)
      .set({
        title,
        startAt,
        endAt,
        recurrenceRule: providerEvent.recurrence?.[0] || null,
        attendees: sql`${JSON.stringify(attendees)}::jsonb`,
        reminders: sql`${JSON.stringify(reminders)}::jsonb`,
        deletedAt: null, // Restore if previously soft-deleted
      })
      .where(eq(events.id, existing.id));

    if (emitSocket) {
      emitEventUpdated(userId, {
        id: existing.id,
        title,
        startAt,
        endAt,
        calendarId,
      });
    }
  } else {
    // Create new event
    const [newEvent] = await db
      .insert(events)
      .values({
        userId,
        calendarId,
        providerEventId,
        title,
        startAt,
        endAt,
        recurrenceRule: providerEvent.recurrence?.[0] || null,
        attendees: sql`${JSON.stringify(attendees)}::jsonb`,
        reminders: sql`${JSON.stringify(reminders)}::jsonb`,
      })
      .returning();

    if (emitSocket) {
      emitEventCreated(userId, {
        id: newEvent.id,
        title,
        startAt,
        endAt,
        calendarId,
      });
    }
  }
}

async function softDeleteEvent(
  userId: string,
  calendarId: string,
  providerEventId: string,
  emitSocket: boolean = false
): Promise<void> {
  const existing = await db.query.events.findFirst({
    where: and(
      eq(events.calendarId, calendarId),
      eq(events.providerEventId, providerEventId)
    ),
  });

  if (existing) {
    await db
      .update(events)
      .set({ deletedAt: new Date() })
      .where(eq(events.id, existing.id));

    if (emitSocket) {
      emitEventDeleted(userId, {
        id: existing.id,
        calendarId,
        providerEventId,
      });
    }
  }
}

export async function performFullSync(context: SyncContext): Promise<void> {
  console.log(`Starting full sync for account ${context.accountId}`);

  const calendarClient = createCalendarClientFromEncrypted(
    context.accessTokenEncrypted,
    context.refreshTokenEncrypted
  );

  // 1. Fetch calendar list
  const calendarList = await calendarClient.calendarList.list();
  const items = calendarList.data.items || [];

  console.log(`Found ${items.length} calendars`);

  // 2. Sync each calendar
  for (const providerCalendar of items) {
    if (!providerCalendar.id) continue;

    const calendarId = await getOrCreateCalendar(context.accountId, {
      id: providerCalendar.id,
      summary: providerCalendar.summary || 'Untitled',
      primary: providerCalendar.primary || false,
      backgroundColor: providerCalendar.backgroundColor || undefined,
    });

    // Calculate time range: past 30 days to next 180 days
    const now = new Date();
    const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString();

    // 3. Fetch events for this calendar
    let pageToken: string | undefined;

    do {
      const eventsResponse = await calendarClient.events.list({
        calendarId: providerCalendar.id,
        timeMin,
        timeMax,
        singleEvents: true,
        maxResults: 2500,
        pageToken,
      });

      const eventItems = eventsResponse.data.items || [];
      console.log(`Fetched ${eventItems.length} events from calendar ${providerCalendar.summary}`);

      // 4. Upsert events
      for (const event of eventItems) {
        if (event.status !== 'cancelled') {
          await upsertEvent(context.userId, calendarId, event);
        }
      }

      pageToken = eventsResponse.data.nextPageToken || undefined;
    } while (pageToken);

    // 5. Register push notification channel for this calendar
    await registerPushChannel(
      calendarClient,
      context.accountId,
      calendarId,
      providerCalendar.id
    );
  }

  // 6. Update sync cursor on account
  await db
    .update(calendarAccounts)
    .set({
      lastSyncAt: new Date(),
    })
    .where(eq(calendarAccounts.id, context.accountId));

  // 7. Setup channel renewal job
  await setupChannelRenewalJob(context.accountId);

  console.log(`Full sync completed for account ${context.accountId}`);
}

export async function performIncrementalSync(
  context: SyncContext,
  providerCalendarId?: string
): Promise<void> {
  console.log(`Starting incremental sync for account ${context.accountId}`);

  const calendarClient = createCalendarClientFromEncrypted(
    context.accessTokenEncrypted,
    context.refreshTokenEncrypted
  );

  // Get calendars to sync
  const calendarsToSync = providerCalendarId
    ? await db.query.calendars.findMany({
        where: and(
          eq(calendars.accountId, context.accountId),
          eq(calendars.providerCalendarId, providerCalendarId)
        ),
      })
    : await db.query.calendars.findMany({
        where: eq(calendars.accountId, context.accountId),
      });

  for (const cal of calendarsToSync) {
    // Get sync token if available
    const account = await db.query.calendarAccounts.findFirst({
      where: eq(calendarAccounts.id, context.accountId),
    });

    let syncToken = account?.syncCursor || undefined;
    let pageToken: string | undefined;
    let hasChanges = false;

    do {
      const eventsResponse = await calendarClient.events.list({
        calendarId: cal.providerCalendarId,
        syncToken,
        pageToken,
        maxResults: 2500,
      });

      const eventItems = eventsResponse.data.items || [];

      for (const event of eventItems) {
        hasChanges = true;
        
        if (event.status === 'cancelled' && event.id) {
          // Soft delete
          await softDeleteEvent(context.userId, cal.id, event.id, true);
        } else {
          // Upsert
          await upsertEvent(context.userId, cal.id, event, true);
        }
      }

      pageToken = eventsResponse.data.nextPageToken || undefined;
      syncToken = eventsResponse.data.nextSyncToken || syncToken;
    } while (pageToken);

    // Update sync cursor
    if (syncToken) {
      await db
        .update(calendarAccounts)
        .set({ syncCursor: syncToken })
        .where(eq(calendarAccounts.id, context.accountId));
    }

    if (hasChanges) {
      console.log(`Incremental sync: processed changes for calendar ${cal.name}`);
    }
  }

  // Update last sync time
  await db
    .update(calendarAccounts)
    .set({ lastSyncAt: new Date() })
    .where(eq(calendarAccounts.id, context.accountId));

  console.log(`Incremental sync completed for account ${context.accountId}`);
}

async function registerPushChannel(
  calendarClient: calendar_v3.Calendar,
  accountId: string,
  calendarDbId: string,
  providerCalendarId: string
): Promise<void> {
  try {
    const channelId = `channel-${accountId}-${providerCalendarId}-${randomUUID()}`;
    const webhookUrl = `${env.API_URL}/api/v1/webhooks/google`;

    const response = await calendarClient.events.watch({
      calendarId: providerCalendarId,
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        token: env.GOOGLE_WEBHOOK_SECRET || undefined,
      },
    });

    if (response.data.resourceId && response.data.expiration) {
      // Store channel info
      await db
        .update(calendars)
        .set({
          channelId: response.data.id,
          resourceId: response.data.resourceId,
          channelExpiration: new Date(parseInt(response.data.expiration)),
        })
        .where(eq(calendars.id, calendarDbId));

      console.log(`Registered push channel for calendar ${providerCalendarId}`);
    }
  } catch (err) {
    console.error(`Failed to register push channel for calendar ${providerCalendarId}:`, err);
    // Don't throw - sync should continue even if push fails
  }
}

export { upsertEvent, softDeleteEvent };
