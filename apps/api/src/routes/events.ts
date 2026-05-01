import type { FastifyInstance } from 'fastify';
import { db, events, calendars, calendarAccounts } from '@time-calendar-manager/db';
import { eq, and, gte, lte, isNull } from 'drizzle-orm';
import { authenticateRequest, AuthenticatedRequest } from '../middleware/auth.js';
import { queueEventWrite } from '../lib/queue.js';

export async function eventsRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply auth middleware to all routes
  fastify.addHook('onRequest', authenticateRequest);

  // List events
  fastify.get('/api/v1/events', async (request, reply) => {
    const user = (request as AuthenticatedRequest).user;
    const { start, end, calendarId } = request.query as {
      start?: string;
      end?: string;
      calendarId?: string;
    };

    // Build where conditions dynamically
    const conditions: (ReturnType<typeof eq> | ReturnType<typeof and> | ReturnType<typeof gte> | ReturnType<typeof lte>)[] = [
      eq(events.userId, user.id),
      isNull(events.deletedAt),
    ];

    if (calendarId) {
      conditions.push(eq(events.calendarId, calendarId));
    }

    if (start) {
      conditions.push(gte(events.endAt, new Date(start)));
    }

    if (end) {
      conditions.push(lte(events.startAt, new Date(end)));
    }

    const results = await db
      .select({
        id: events.id,
        title: events.title,
        startAt: events.startAt,
        endAt: events.endAt,
        calendarId: events.calendarId,
        providerEventId: events.providerEventId,
        recurrenceRule: events.recurrenceRule,
        attendees: events.attendees,
        isTimeBlock: events.isTimeBlock,
        taskId: events.taskId,
      })
      .from(events)
      .innerJoin(calendars, eq(events.calendarId, calendars.id))
      .where(and(...conditions));

    reply.send({ events: results });
  });

  // Create event
  fastify.post('/api/v1/events', async (request, reply) => {
    const user = (request as AuthenticatedRequest).user;
    const { calendarId, title, startAt, endAt, description, attendees } = request.body as {
      calendarId: string;
      title: string;
      startAt: string;
      endAt: string;
      description?: string;
      attendees?: string[];
    };

    // Validate calendar belongs to user via account
    const calendarWithAccount = await db
      .select({
        calendar: calendars,
        account: calendarAccounts,
      })
      .from(calendars)
      .innerJoin(calendarAccounts, eq(calendars.accountId, calendarAccounts.id))
      .where(and(
        eq(calendars.id, calendarId),
        eq(calendars.isVisible, true),
        eq(calendarAccounts.userId, user.id)
      ))
      .limit(1);

    if (calendarWithAccount.length === 0) {
      reply.status(404).send({ error: 'Calendar not found' });
      return;
    }

    const { calendar, account } = calendarWithAccount[0];

    // Create event in database
    const [newEvent] = await db
      .insert(events)
      .values({
        userId: user.id,
        calendarId,
        title,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        providerEventId: `local-${Date.now()}`, // Temporary ID
      })
      .returning();

    // Queue write-back to Google Calendar
    await queueEventWrite({
      type: 'create',
      accountId: calendar.accountId,
      calendarId,
      eventId: newEvent.id,
      eventData: {
        title,
        startAt,
        endAt,
        description,
        attendees,
      },
    });

    reply.status(201).send(newEvent);
  });

  // Update event
  fastify.patch('/api/v1/events/:id', async (request, reply) => {
    const user = (request as AuthenticatedRequest).user;
    const { id } = request.params as { id: string };
    const { title, startAt, endAt, description, attendees } = request.body as {
      title?: string;
      startAt?: string;
      endAt?: string;
      description?: string;
      attendees?: string[];
    };

    const eventWithCalendar = await db
      .select({
        event: events,
        calendar: calendars,
        account: calendarAccounts,
      })
      .from(events)
      .innerJoin(calendars, eq(events.calendarId, calendars.id))
      .innerJoin(calendarAccounts, eq(calendars.accountId, calendarAccounts.id))
      .where(and(
        eq(events.id, id),
        eq(events.userId, user.id)
      ))
      .limit(1);

    if (eventWithCalendar.length === 0) {
      reply.status(404).send({ error: 'Event not found' });
      return;
    }

    const { event, calendar, account } = eventWithCalendar[0];

    // Update in database
    const updates: Partial<typeof events.$inferInsert> = {};
    if (title !== undefined) updates.title = title;
    if (startAt !== undefined) updates.startAt = new Date(startAt);
    if (endAt !== undefined) updates.endAt = new Date(endAt);

    await db
      .update(events)
      .set(updates)
      .where(eq(events.id, id));

    // Queue write-back to Google Calendar
    await queueEventWrite({
      type: 'update',
      accountId: calendar.accountId,
      calendarId: event.calendarId,
      providerEventId: event.providerEventId,
      eventData: {
        title: title ?? event.title,
        startAt: startAt ?? event.startAt.toISOString(),
        endAt: endAt ?? event.endAt.toISOString(),
        description,
        attendees,
      },
    });

    reply.send({ success: true });
  });

  // Delete event
  fastify.delete('/api/v1/events/:id', async (request, reply) => {
    const user = (request as AuthenticatedRequest).user;
    const { id } = request.params as { id: string };

    const eventWithCalendar = await db
      .select({
        event: events,
        calendar: calendars,
        account: calendarAccounts,
      })
      .from(events)
      .innerJoin(calendars, eq(events.calendarId, calendars.id))
      .innerJoin(calendarAccounts, eq(calendars.accountId, calendarAccounts.id))
      .where(and(
        eq(events.id, id),
        eq(events.userId, user.id)
      ))
      .limit(1);

    if (eventWithCalendar.length === 0) {
      reply.status(404).send({ error: 'Event not found' });
      return;
    }

    const { event, calendar } = eventWithCalendar[0];

    // Soft delete in database
    await db
      .update(events)
      .set({ deletedAt: new Date() })
      .where(eq(events.id, id));

    // Queue write-back to Google Calendar
    await queueEventWrite({
      type: 'delete',
      accountId: calendar.accountId,
      calendarId: event.calendarId,
      providerEventId: event.providerEventId,
    });

    reply.send({ success: true });
  });
}
