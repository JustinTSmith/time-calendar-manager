import { Worker } from 'bullmq';
import { redisConnection, QUEUE_NAMES, FullSyncJobData, IncrementalSyncJobData, SubscriptionRenewalJobData, EventWriteJobData } from '../lib/queue.js';
import { performFullSync, performIncrementalSync } from '../services/calendar-sync/microsoft-sync.js';
import { createSubscription, renewSubscription, deleteSubscription } from '../services/microsoft/subscription-manager.js';
import { writeEventToMicrosoft, updateMicrosoftEvent, deleteMicrosoftEvent } from '../services/calendar-sync/event-writeback.js';
import { getValidAccessToken } from '../services/token-manager.js';
import { eq } from 'drizzle-orm';
import { db, calendarAccounts, calendars } from '../lib/db.js';

// Full sync worker
export const fullSyncWorker = new Worker<FullSyncJobData>(
  QUEUE_NAMES.SYNC,
  async (job) => {
    const { accountId, userId } = job.data;
    console.log(`[Full Sync] Starting for account ${accountId}`);

    try {
      const result = await performFullSync(accountId);
      console.log(`[Full Sync] Completed for account ${accountId}:`, result);

      // After full sync, create webhook subscription
      const account = await db.query.calendarAccounts.findFirst({
        where: eq(calendarAccounts.id, accountId),
        with: { calendars: true },
      });

      if (account && account.calendars.length > 0) {
        const accessToken = await getValidAccessToken(accountId);
        const primaryCalendar = account.calendars.find(c => c.isPrimary) || account.calendars[0];
        
        const subscription = await createSubscription(
          accessToken,
          primaryCalendar.providerCalendarId,
          accountId
        );

        // Store subscription info
        await db.update(calendarAccounts)
          .set({
            subscriptionId: subscription.id,
            subscriptionExpiresAt: new Date(subscription.expirationDateTime),
            updatedAt: new Date(),
          })
          .where(eq(calendarAccounts.id, accountId));

        // Schedule renewal job
        await scheduleSubscriptionRenewal(accountId, subscription.id, subscription.expirationDateTime);
      }

      return result;
    } catch (error) {
      console.error(`[Full Sync] Failed for account ${accountId}:`, error);
      throw error;
    }
  },
  { connection: redisConnection }
);

// Incremental sync worker
export const incrementalSyncWorker = new Worker<IncrementalSyncJobData>(
  QUEUE_NAMES.SYNC,
  async (job) => {
    const { accountId, userId } = job.data;
    console.log(`[Incremental Sync] Starting for account ${accountId}`);

    try {
      const result = await performIncrementalSync(accountId);
      console.log(`[Incremental Sync] Completed for account ${accountId}:`, result);
      return result;
    } catch (error) {
      console.error(`[Incremental Sync] Failed for account ${accountId}:`, error);
      throw error;
    }
  },
  { connection: redisConnection }
);

// Subscription renewal worker
export const subscriptionRenewalWorker = new Worker<SubscriptionRenewalJobData>(
  QUEUE_NAMES.SUBSCRIPTION_RENEWAL,
  async (job) => {
    const { subscriptionId, accountId } = job.data;
    console.log(`[Subscription Renewal] Starting for subscription ${subscriptionId}`);

    try {
      const accessToken = await getValidAccessToken(accountId);
      
      // Renew subscription (extend by 2 days)
      const newExpiration = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      await renewSubscription(accessToken, subscriptionId, newExpiration);

      // Update database
      await db.update(calendarAccounts)
        .set({
          subscriptionExpiresAt: newExpiration,
          updatedAt: new Date(),
        })
        .where(eq(calendarAccounts.id, accountId));

      // Schedule next renewal
      await scheduleSubscriptionRenewal(accountId, subscriptionId, newExpiration.toISOString());

      console.log(`[Subscription Renewal] Completed for subscription ${subscriptionId}`);
    } catch (error) {
      console.error(`[Subscription Renewal] Failed for subscription ${subscriptionId}:`, error);
      
      // If renewal fails, try to create a new subscription
      try {
        const account = await db.query.calendarAccounts.findFirst({
          where: eq(calendarAccounts.id, accountId),
          with: { calendars: true },
        });

        if (account && account.calendars.length > 0) {
          const accessToken = await getValidAccessToken(accountId);
          const primaryCalendar = account.calendars.find(c => c.isPrimary) || account.calendars[0];
          
          const subscription = await createSubscription(
            accessToken,
            primaryCalendar.providerCalendarId,
            accountId
          );

          await db.update(calendarAccounts)
            .set({
              subscriptionId: subscription.id,
              subscriptionExpiresAt: new Date(subscription.expirationDateTime),
              updatedAt: new Date(),
            })
            .where(eq(calendarAccounts.id, accountId));

          await scheduleSubscriptionRenewal(accountId, subscription.id, subscription.expirationDateTime);
        }
      } catch (retryError) {
        console.error(`[Subscription Renewal] Retry failed:`, retryError);
        throw retryError;
      }
    }
  },
  { connection: redisConnection }
);

// Event write-back worker
export const eventWriteWorker = new Worker<EventWriteJobData>(
  QUEUE_NAMES.EVENT_WRITE,
  async (job) => {
    const { accountId, eventId, operation, changes } = job.data;
    console.log(`[Event Write] ${operation} event ${eventId} for account ${accountId}`);

    try {
      switch (operation) {
        case 'create':
          await writeEventToMicrosoft(accountId, eventId);
          break;
        case 'update':
          if (changes) {
            await updateMicrosoftEvent(accountId, eventId, changes);
          }
          break;
        case 'delete':
          await deleteMicrosoftEvent(accountId, eventId);
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      console.log(`[Event Write] Completed ${operation} for event ${eventId}`);
    } catch (error) {
      console.error(`[Event Write] Failed ${operation} for event ${eventId}:`, error);
      throw error;
    }
  },
  { connection: redisConnection }
);

// Helper function to schedule subscription renewal
async function scheduleSubscriptionRenewal(
  accountId: string,
  subscriptionId: string,
  expirationDateTime: string
): Promise<void> {
  const { subscriptionRenewalQueue } = await import('../lib/queue.js');
  
  // Schedule renewal 2 hours before expiration
  const expiration = new Date(expirationDateTime);
  const renewalTime = new Date(expiration.getTime() - 2 * 60 * 60 * 1000);

  await subscriptionRenewalQueue.add(
    'renew-subscription',
    { subscriptionId, accountId },
    {
      jobId: `renewal-${subscriptionId}`,
      delay: renewalTime.getTime() - Date.now(),
    }
  );
}

// Error handlers
fullSyncWorker.on('failed', (job, err) => {
  console.error(`Full sync job ${job?.id} failed:`, err);
});

incrementalSyncWorker.on('failed', (job, err) => {
  console.error(`Incremental sync job ${job?.id} failed:`, err);
});

subscriptionRenewalWorker.on('failed', (job, err) => {
  console.error(`Subscription renewal job ${job?.id} failed:`, err);
});

eventWriteWorker.on('failed', (job, err) => {
  console.error(`Event write job ${job?.id} failed:`, err);
});

console.log('[Workers] All workers initialized');
