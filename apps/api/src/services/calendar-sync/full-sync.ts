import { Worker } from 'bullmq';
import { db, calendarAccounts } from '@time-calendar-manager/db';
import { eq } from 'drizzle-orm';
import { redis } from '../../lib/redis.js';
import { fullSyncQueue, FullSyncJob } from '../../lib/queue.js';
import { performFullSync, SyncContext } from './google-sync.js';

const fullSyncWorker = new Worker<FullSyncJob>(
  'full-sync',
  async (job) => {
    console.log(`Processing full sync job ${job.id} for account ${job.data.accountId}`);

    const { accountId, userId } = job.data;

    // Get account with tokens
    const account = await db.query.calendarAccounts.findFirst({
      where: eq(calendarAccounts.id, accountId),
    });

    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    if (account.status !== 'active') {
      console.log(`Skipping sync for inactive account ${accountId}`);
      return;
    }

    const context: SyncContext = {
      accountId,
      userId,
      accessTokenEncrypted: account.accessTokenEncrypted,
      refreshTokenEncrypted: account.refreshTokenEncrypted,
    };

    await performFullSync(context);
  },
  {
    connection: redis,
    concurrency: 3,
  }
);

fullSyncWorker.on('completed', (job) => {
  console.log(`Full sync job ${job.id} completed`);
});

fullSyncWorker.on('failed', (job, err) => {
  console.error(`Full sync job ${job?.id} failed:`, err);
});

console.log('Full sync worker started');
