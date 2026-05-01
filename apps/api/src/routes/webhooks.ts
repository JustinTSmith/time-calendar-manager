import type { FastifyInstance } from 'fastify';
import { db, calendars, calendarAccounts } from '@time-calendar-manager/db';
import { eq, and } from 'drizzle-orm';
import { queueIncrementalSync } from '../lib/queue.js';
import { env } from '../config/env.js';

export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  // Google Calendar push notification webhook
  fastify.post('/api/v1/webhooks/google', async (request, reply) => {
    // Validate headers
    const channelId = request.headers['x-goog-channel-id'] as string;
    const resourceId = request.headers['x-goog-resource-id'] as string;
    const resourceState = request.headers['x-goog-resource-state'] as string;
    const channelToken = request.headers['x-goog-channel-token'] as string;

    if (!channelId || !resourceId) {
      reply.status(400).send({ error: 'Missing required headers' });
      return;
    }

    // Validate channel token if configured
    if (env.GOOGLE_WEBHOOK_SECRET && channelToken !== env.GOOGLE_WEBHOOK_SECRET) {
      reply.status(401).send({ error: 'Invalid channel token' });
      return;
    }

    // Acknowledge immediately (Google requires quick response)
    reply.status(200).send({ received: true });

    // Find the calendar by channel info
    const calendar = await db.query.calendars.findFirst({
      where: and(
        eq(calendars.channelId, channelId),
        eq(calendars.resourceId, resourceId)
      ),
    });

    if (!calendar) {
      console.warn(`Webhook received for unknown channel: ${channelId}`);
      return;
    }

    // Get the account
    const account = await db.query.calendarAccounts.findFirst({
      where: eq(calendarAccounts.id, calendar.accountId),
    });

    if (!account || account.status !== 'active') {
      console.warn(`Webhook: account not found or inactive for calendar ${calendar.id}`);
      return;
    }

    console.log(`Webhook: ${resourceState} event for calendar ${calendar.name} (${calendar.providerCalendarId})`);

    // Queue incremental sync
    await queueIncrementalSync(account.id, account.userId, calendar.providerCalendarId);
  });

  // Sync notification endpoint (for manual testing/debugging)
  fastify.post('/api/v1/webhooks/sync', async (request, reply) => {
    const { accountId } = request.body as { accountId?: string };

    if (!accountId) {
      reply.status(400).send({ error: 'accountId required' });
      return;
    }

    const account = await db.query.calendarAccounts.findFirst({
      where: eq(calendarAccounts.id, accountId),
    });

    if (!account) {
      reply.status(404).send({ error: 'Account not found' });
      return;
    }

    await queueIncrementalSync(account.id, account.userId);

    reply.send({ queued: true });
  });
}
