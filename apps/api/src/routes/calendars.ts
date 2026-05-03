import type { FastifyInstance } from 'fastify';
import { db, calendars, calendarAccounts } from '@time-calendar-manager/db';
import { eq, and } from 'drizzle-orm';
import { authenticateRequest, AuthenticatedRequest } from '../middleware/auth.js';
import { queueIncrementalSync } from '../lib/queue.js';

export async function calendarsRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply auth middleware to all routes
  fastify.addHook('onRequest', authenticateRequest);

  // List user's calendars
  fastify.get('/api/v1/calendars', async (request, reply) => {
    const user = (request as AuthenticatedRequest).user;

    const results = await db
      .select({
        id: calendars.id,
        name: calendars.name,
        color: calendars.color,
        isPrimary: calendars.isPrimary,
        isVisible: calendars.isVisible,
        accountId: calendars.accountId,
        providerCalendarId: calendars.providerCalendarId,
      })
      .from(calendars)
      .innerJoin(calendarAccounts, eq(calendars.accountId, calendarAccounts.id))
      .where(eq(calendarAccounts.userId, user.id));

    reply.send({ calendars: results });
  });

  // Update calendar visibility
  fastify.patch('/api/v1/calendars/:id', async (request, reply) => {
    const user = (request as AuthenticatedRequest).user;
    const { id } = request.params as { id: string };
    const { isVisible, color } = request.body as { isVisible?: boolean; color?: string };

    // Verify calendar belongs to user via account
    const calendarWithAccount = await db
      .select({ calendar: calendars, account: calendarAccounts })
      .from(calendars)
      .innerJoin(calendarAccounts, eq(calendars.accountId, calendarAccounts.id))
      .where(and(
        eq(calendars.id, id),
        eq(calendarAccounts.userId, user.id)
      ))
      .limit(1);

    if (calendarWithAccount.length === 0) {
      reply.status(404).send({ error: 'Calendar not found' });
      return;
    }

    const updates: Partial<typeof calendars.$inferInsert> = {};
    if (isVisible !== undefined) updates.isVisible = isVisible;
    if (color !== undefined) updates.color = color;

    await db
      .update(calendars)
      .set(updates)
      .where(eq(calendars.id, id));

    reply.send({ success: true });
  });

  // Trigger manual sync
  fastify.post('/api/v1/calendars/:id/sync', async (request, reply) => {
    const user = (request as AuthenticatedRequest).user;
    const { id } = request.params as { id: string };

    const calendarWithAccount = await db
      .select({ calendar: calendars, account: calendarAccounts })
      .from(calendars)
      .innerJoin(calendarAccounts, eq(calendars.accountId, calendarAccounts.id))
      .where(and(
        eq(calendars.id, id),
        eq(calendarAccounts.userId, user.id)
      ))
      .limit(1);

    if (calendarWithAccount.length === 0) {
      reply.status(404).send({ error: 'Calendar not found' });
      return;
    }

    const { calendar, account } = calendarWithAccount[0];

    await queueIncrementalSync(calendar.accountId, user.id, calendar.providerCalendarId);

    reply.send({ queued: true });
  });

  // List calendar accounts
  fastify.get('/api/v1/calendar-accounts', async (request, reply) => {
    const user = (request as AuthenticatedRequest).user;

    const accounts = await db.query.calendarAccounts.findMany({
      where: eq(calendarAccounts.userId, user.id),
      columns: {
        id: true,
        provider: true,
        status: true,
        lastSyncAt: true,
        createdAt: true,
      },
    });

    reply.send({ accounts });
  });

  // Delete calendar account
  fastify.delete('/api/v1/calendar-accounts/:id', async (request, reply) => {
    const user = (request as AuthenticatedRequest).user;
    const { id } = request.params as { id: string };

    const account = await db.query.calendarAccounts.findFirst({
      where: and(
        eq(calendarAccounts.id, id),
        eq(calendarAccounts.userId, user.id)
      ),
    });

    if (!account) {
      reply.status(404).send({ error: 'Account not found' });
      return;
    }

    await db
      .update(calendarAccounts)
      .set({ status: 'disconnected' })
      .where(eq(calendarAccounts.id, id));

    reply.send({ success: true });
  });
}
