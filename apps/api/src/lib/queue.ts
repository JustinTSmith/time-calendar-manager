import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env.js';

// Redis connection for BullMQ
export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Queue names
export const QUEUE_NAMES = {
  SYNC: 'calendar-sync',
  EVENT_WRITE: 'event-write',
  SUBSCRIPTION_RENEWAL: 'subscription-renewal',
} as const;

// Job types
export interface FullSyncJobData {
  accountId: string;
  userId: string;
}

export interface IncrementalSyncJobData {
  accountId: string;
  userId: string;
  calendarId?: string;
}

export interface SubscriptionRenewalJobData {
  subscriptionId: string;
  accountId: string;
}

export interface EventWriteJobData {
  accountId: string;
  eventId: string;
  operation: 'create' | 'update' | 'delete';
  changes?: Record<string, unknown>;
}

// Queues
export const syncQueue = new Queue<FullSyncJobData | IncrementalSyncJobData>(QUEUE_NAMES.SYNC, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

export const eventWriteQueue = new Queue<EventWriteJobData>(QUEUE_NAMES.EVENT_WRITE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

export const subscriptionRenewalQueue = new Queue<SubscriptionRenewalJobData>(QUEUE_NAMES.SUBSCRIPTION_RENEWAL, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'fixed',
      delay: 60000,
    },
  },
});

// Type for job processors
export type JobProcessor<T> = (job: Job<T>) => Promise<void>;

// Cleanup function
export const closeQueueConnections = async (): Promise<void> => {
  await syncQueue.close();
  await eventWriteQueue.close();
  await subscriptionRenewalQueue.close();
  await redisConnection.quit();
};
