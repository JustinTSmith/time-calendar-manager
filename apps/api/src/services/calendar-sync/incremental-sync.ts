import { Worker } from 'bullmq';
import { db, calendarAccounts } from '@time-calendar-manager/db';
import { eq } from 'drizzle-orm';
import { redis } from '../../lib/redis.js';
import { incrementalSyncQueue, IncrementalSyncJob } from '../../lib/queue.js';
import { performIncrementalSync, SyncContext } from './google-sync.js';

const incrementalSyncWorker = new Worker<IncrementalSyncJob>(
  'incremental-sync',
  async (job) => {
    console.log(`Processing incremental sync job ${job.id} for account ${job.data.accountId}`);

    const { accountId, userId, calendarId } = job.data;

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

    await performIncrementalSync(context, calendarId);
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

incrementalSyncWorker.on('completed', (job) => {
  console.log(`Incremental sync job ${job.id} completed`);
});

incrementalSyncWorker.on('failed', (job, err) => {
  console.error(`Incremental sync job ${job?.id} failed:`, err);
});

console.log('Incremental sync worker started');
