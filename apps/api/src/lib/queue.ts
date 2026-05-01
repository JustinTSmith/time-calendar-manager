import { Queue, Worker, Job } from 'bullmq';
import { redis } from './redis.js';

// Queues
export const fullSyncQueue = new Queue('full-sync', { connection: redis });
export const incrementalSyncQueue = new Queue('incremental-sync', { connection: redis });
export const eventWriteQueue = new Queue('event-write', { connection: redis });
export const channelRenewalQueue = new Queue('channel-renewal', { connection: redis });

// Job types
export interface FullSyncJob {
  accountId: string;
  userId: string;
}

export interface IncrementalSyncJob {
  accountId: string;
  userId: string;
  calendarId?: string;
}

export interface EventWriteJob {
  type: 'create' | 'update' | 'delete';
  accountId: string;
  calendarId: string;
  eventId?: string;
  eventData?: {
    title: string;
    startAt: string;
    endAt: string;
    description?: string;
    attendees?: string[];
  };
  providerEventId?: string;
}

export interface ChannelRenewalJob {
  accountId: string;
}

// Queue job adders
export async function queueFullSync(accountId: string, userId: string): Promise<Job<FullSyncJob>> {
  return fullSyncQueue.add(
    'full-sync',
    { accountId, userId },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    }
  );
}

export async function queueIncrementalSync(
  accountId: string,
  userId: string,
  calendarId?: string
): Promise<Job<IncrementalSyncJob>> {
  return incrementalSyncQueue.add(
    'incremental-sync',
    { accountId, userId, calendarId },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    }
  );
}

export async function queueEventWrite(jobData: EventWriteJob): Promise<Job<EventWriteJob>> {
  return eventWriteQueue.add(
    `event-${jobData.type}`,
    jobData,
    {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    }
  );
}

export async function queueChannelRenewal(accountId: string): Promise<Job<ChannelRenewalJob>> {
  return channelRenewalQueue.add(
    'channel-renewal',
    { accountId },
    {
      attempts: 3,
      backoff: {
        type: 'fixed',
        delay: 60000,
      },
    }
  );
}

// Setup repeatable job for channel renewal (every 6 days to be safe)
export async function setupChannelRenewalJob(accountId: string): Promise<void> {
  await channelRenewalQueue.add(
    'channel-renewal-repeatable',
    { accountId },
    {
      repeat: {
        pattern: '0 0 */6 * *', // Every 6 days at midnight
      },
      jobId: `renewal-${accountId}`,
    }
  );
}

export async function removeChannelRenewalJob(accountId: string): Promise<void> {
  await channelRenewalQueue.removeRepeatableByKey(`renewal-${accountId}`);
}
