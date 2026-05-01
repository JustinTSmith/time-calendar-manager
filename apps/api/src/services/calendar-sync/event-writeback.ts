import { eq } from 'drizzle-orm';
import { db, events, calendars, calendarAccounts, tasks } from '../../lib/db.js';
import { getValidAccessToken } from '../token-manager.js';
import { createEvent, updateEvent, deleteEvent, MicrosoftEvent } from '../microsoft/microsoft-graph.js';

interface EventChanges {
  title?: string;
  startAt?: Date;
  endAt?: Date;
  recurrenceRule?: string | null;
  attendees?: Array<{ name: string; email: string; response?: string }>;
}

/**
 * Write a local event to Microsoft Calendar
 * Used when a task is scheduled and needs to be synced to Outlook
 */
export async function writeEventToMicrosoft(
  accountId: string,
  localEventId: string
): Promise<string> {
  // Get the local event with calendar info
  const localEvent = await db.query.events.findFirst({
    where: eq(events.id, localEventId),
    with: {
      calendar: true,
    },
  });

  if (!localEvent) {
    throw new Error(`Event not found: ${localEventId}`);
  }

  // Get access token
  const accessToken = await getValidAccessToken(accountId);

  // Convert local event to Microsoft format
  const msEvent = convertToMicrosoftEvent(localEvent);

  // Create event in Microsoft
  const createdEvent = await createEvent(
    accessToken,
    localEvent.calendar.providerCalendarId,
    msEvent
  );

  // Update local event with Microsoft event ID
  await db.update(events)
    .set({
      providerEventId: createdEvent.id,
      updatedAt: new Date(),
    })
    .where(eq(events.id, localEventId));

  return createdEvent.id;
}

/**
 * Update a Microsoft event when local event changes
 */
export async function updateMicrosoftEvent(
  accountId: string,
  providerEventId: string,
  changes: EventChanges
): Promise<void> {
  const accessToken = await getValidAccessToken(accountId);

  // Convert changes to Microsoft format
  const msChanges: Partial<MicrosoftEvent> = {};

  if (changes.title) {
    msChanges.subject = changes.title;
  }

  if (changes.startAt) {
    msChanges.start = {
      dateTime: changes.startAt.toISOString(),
      timeZone: 'UTC',
    };
  }

  if (changes.endAt) {
    msChanges.end = {
      dateTime: changes.endAt.toISOString(),
      timeZone: 'UTC',
    };
  }

  if (changes.attendees) {
    msChanges.attendees = changes.attendees.map(attendee => ({
      emailAddress: {
        name: attendee.name,
        address: attendee.email,
      },
      type: 'required',
      status: {
        response: attendee.response || 'notResponded',
        time: new Date().toISOString(),
      },
    }));
  }

  // TODO: Handle recurrence rule conversion

  await updateEvent(accessToken, providerEventId, msChanges);
}

/**
 * Delete a Microsoft event
 */
export async function deleteMicrosoftEvent(
  accountId: string,
  providerEventId: string
): Promise<void> {
  const accessToken = await getValidAccessToken(accountId);
  await deleteEvent(accessToken, providerEventId);
}

/**
 * Convert local event to Microsoft Graph event format
 */
function convertToMicrosoftEvent(localEvent: {
  title: string;
  startAt: Date;
  endAt: Date;
  recurrenceRule: string | null;
  attendees: Array<unknown>;
  isTimeBlock: boolean;
}): Partial<MicrosoftEvent> {
  const msEvent: Partial<MicrosoftEvent> = {
    subject: localEvent.title,
    start: {
      dateTime: localEvent.startAt.toISOString(),
      timeZone: 'UTC',
    },
    end: {
      dateTime: localEvent.endAt.toISOString(),
      timeZone: 'UTC',
    },
    attendees: (localEvent.attendees as Array<{ name: string; email: string; response?: string }>).map(attendee => ({
      emailAddress: {
        name: attendee.name,
        address: attendee.email,
      },
      type: 'required',
      status: {
        response: attendee.response || 'notResponded',
        time: new Date().toISOString(),
      },
    })),
  };

  // TODO: Convert RRULE to Microsoft recurrence format if needed
  // For now, we skip recurrence in write-back

  return msEvent;
}

/**
 * Queue an event write operation
 * This is called when a task is scheduled and needs to sync to Microsoft
 */
export async function queueEventWrite(
  accountId: string,
  eventId: string,
  operation: 'create' | 'update' | 'delete',
  changes?: EventChanges
): Promise<void> {
  const { eventWriteQueue } = await import('../../lib/queue.js');

  await eventWriteQueue.add(`event-${operation}`, {
    accountId,
    eventId,
    operation,
    changes,
  }, {
    jobId: `event-${operation}-${eventId}-${Date.now()}`,
  });
}
