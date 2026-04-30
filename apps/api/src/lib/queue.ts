export type WriteBackJob = {
  jobType: 'event.write' | 'event.delete';
  eventId: string;
  userId: string;
};

export function enqueue(job: WriteBackJob): void {
  console.log(`[queue] enqueued job=${job.jobType} eventId=${job.eventId} userId=${job.userId}`);
}
