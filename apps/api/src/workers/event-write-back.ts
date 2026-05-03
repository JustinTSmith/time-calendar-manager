import { Worker } from 'bullmq';
import { calendar_v3 } from 'googleapis';
import { db, events, calendars, calendarAccounts } from '@time-calendar-manager/db';
import { eq } from 'drizzle-orm';
import { redis } from '../lib/redis.js';
import { createCalendarClientFromEncrypted } from '../lib/google-client.js';
import { eventWriteQueue, EventWriteJob } from '../lib/queue.js';
import { decrypt, deserializeEncrypted } from '../lib/encryption.js';

// Map our event to Google Calendar event format
function mapToGoogleEvent(eventData: EventWriteJob['eventData']): calendar_v3.Schema$Event {
  if (!eventData) {
    throw new Error('Event data required');
  }

  return {
    summary: eventData.title,
    description: eventData.description,
    start: {
      dateTime: eventData.startAt,
    },
    end: {
      dateTime: eventData.endAt,
    },
    attendees: eventData.attendees?.map(email => ({ email })),
  };
}

// Worker to process event write-back jobs
const eventWriteWorker = new Worker<EventWriteJob>(
  'event-write',
  async (job) => {
    console.log(`Processing event write-back job ${job.id}: ${job.data.type}`);

    const { type, accountId, calendarId, eventId, eventData, providerEventId } = job.data;

    // Get account with tokens
    const account = await db.query.calendarAccounts.findFirst({
      where: eq(calendarAccounts.id, accountId),
    });

    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    // Get calendar with provider ID
    const calendar = await db.query.calendars.findFirst({
      where: eq(calendars.id, calendarId),
    });

    if (!calendar) {
      throw new Error(`Calendar not found: ${calendarId}`);
    }

    // Create Google Calendar client
    const calendarClient = createCalendarClientFromEncrypted(
      account.accessTokenEncrypted,
      account.refreshTokenEncrypted
    );

    try {
      switch (type) {
        case 'create': {
          const googleEvent = mapToGoogleEvent(eventData);
          const response = await calendarClient.events.insert({
            calendarId: calendar.providerCalendarId,
            requestBody: googleEvent,
          });

          // Update local event with provider ID
          if (eventId && response.data.id) {
            await db
              .update(events)
              .set({ providerEventId: response.data.id })
              .where(eq(events.id, eventId));
          }

          console.log(`Created event in Google Calendar: ${response.data.id}`);
          break;
        }

        case 'update': {
          if (!providerEventId) {
            throw new Error('providerEventId required for update');
          }

          const googleEvent = mapToGoogleEvent(eventData);
          const response = await calendarClient.events.patch({
            calendarId: calendar.providerCalendarId,
            eventId: providerEventId,
            requestBody: googleEvent,
          });

          console.log(`Updated event in Google Calendar: ${response.data.id}`);
          break;
        }

        case 'delete': {
          if (!providerEventId) {
            throw new Error('providerEventId required for delete');
          }

          await calendarClient.events.delete({
            calendarId: calendar.providerCalendarId,
            eventId: providerEventId,
          });

          console.log(`Deleted event from Google Calendar: ${providerEventId}`);
          break;
        }

        default:
          throw new Error(`Unknown event write type: ${type}`);
      }
    } catch (err) {
      console.error(`Event write-back failed:`, err);
      throw err; // Will trigger retry
    }
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

eventWriteWorker.on('completed', (job) => {
  console.log(`Event write-back job ${job.id} completed`);
});

eventWriteWorker.on('failed', (job, err) => {
  console.error(`Event write-back job ${job?.id} failed:`, err);
});

// Channel renewal worker
const channelRenewalWorker = new Worker(
  'channel-renewal',
  async (job) => {
    const { accountId } = job.data as { accountId: string };
    console.log(`Processing channel renewal for account ${accountId}`);

    const account = await db.query.calendarAccounts.findFirst({
      where: eq(calendarAccounts.id, accountId),
    });

    if (!account || account.status !== 'active') {
      console.log(`Skipping renewal for inactive account ${accountId}`);
      return;
    }

    // Re-register push channels for all calendars
    const calendarClient = createCalendarClientFromEncrypted(
      account.accessTokenEncrypted,
      account.refreshTokenEncrypted
    );

    const accountCalendars = await db.query.calendars.findMany({
      where: eq(calendars.accountId, accountId),
    });

    for (const cal of accountCalendars) {
      try {
        // Stop existing channel if exists
        if (cal.channelId && cal.resourceId) {
          try {
            await calendarClient.channels.stop({
              requestBody: {
                id: cal.channelId,
                resourceId: cal.resourceId,
              },
            });
          } catch (stopErr) {
            // Ignore errors when stopping (channel may already be expired)
            console.log(`Could not stop existing channel for ${cal.name}, continuing...`);
          }
        }

        // Register new channel
        const { randomUUID } = await import('crypto');
        const { env } = await import('../config/env.js');
        
        const channelId = `channel-${accountId}-${cal.providerCalendarId}-${randomUUID()}`;
        const webhookUrl = `${env.API_URL}/api/v1/webhooks/google`;

        const response = await calendarClient.events.watch({
          calendarId: cal.providerCalendarId,
          requestBody: {
            id: channelId,
            type: 'web_hook',
            address: webhookUrl,
            token: env.GOOGLE_WEBHOOK_SECRET || undefined,
          },
        });

        if (response.data.resourceId && response.data.expiration) {
          await db
            .update(calendars)
            .set({
              channelId: response.data.id,
              resourceId: response.data.resourceId,
              channelExpiration: new Date(parseInt(response.data.expiration)),
            })
            .where(eq(calendars.id, cal.id));

          console.log(`Renewed push channel for calendar ${cal.name}`);
        }
      } catch (err) {
        console.error(`Failed to renew channel for calendar ${cal.name}:`, err);
        // Continue with other calendars
      }
    }
  },
  {
    connection: redis,
  }
);

channelRenewalWorker.on('completed', (job) => {
  console.log(`Channel renewal job ${job.id} completed`);
});

channelRenewalWorker.on('failed', (job, err) => {
  console.error(`Channel renewal job ${job?.id} failed:`, err);
});

// Sync workers
import('../services/calendar-sync/full-sync.js');
import('../services/calendar-sync/incremental-sync.js');

console.log('Event write-back and channel renewal workers started');

// Keep process alive
process.on('SIGTERM', async () => {
  console.log('Shutting down workers...');
  await eventWriteWorker.close();
  await channelRenewalWorker.close();
  await redis.disconnect();
  process.exit(0);
});
