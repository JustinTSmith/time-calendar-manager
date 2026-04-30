import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db, calendarAccounts, calendars, calendarSets } from '@time-calendar-manager/db';
import type {
  CalendarAccountDto,
  CalendarDto,
  CalendarSetDto,
  GetCalendarsResponse,
  PatchCalendarBody,
} from '@time-calendar-manager/types';

type Env = { Variables: { userId: string } };

export const calendarsRouter = new Hono<Env>();

calendarsRouter.get('/', async (c) => {
  const userId = c.get('userId');

  const accounts = await db.query.calendarAccounts.findMany({
    where: eq(calendarAccounts.userId, userId),
    with: { calendars: true },
  });

  const sets = await db.query.calendarSets.findMany({
    where: eq(calendarSets.userId, userId),
  });

  const response: GetCalendarsResponse = {
    accounts: accounts.map(
      (acct): CalendarAccountDto => ({
        id: acct.id,
        provider: acct.provider as CalendarAccountDto['provider'],
        email: acct.email ?? null,
        status: acct.status,
        calendars: acct.calendars.map(
          (cal): CalendarDto => ({
            id: cal.id,
            name: cal.name,
            color: cal.color ?? null,
            isPrimary: cal.isPrimary,
            isVisible: cal.isVisible,
          }),
        ),
      }),
    ),
    calendarSets: sets.map(
      (s): CalendarSetDto => ({
        id: s.id,
        name: s.name,
        calendarIds: s.calendarIds,
      }),
    ),
  };

  return c.json(response);
});

calendarsRouter.patch('/:id', async (c) => {
  const calendarId = c.req.param('id');
  const body = await c.req.json<PatchCalendarBody>();

  const updates: Partial<typeof calendars.$inferInsert> = {};

  if (body.is_visible !== undefined) {
    updates.isVisible = body.is_visible;
  }

  if (body.color !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(body.color)) {
      return c.json({ error: 'Invalid color format' }, 400);
    }
    updates.color = body.color;
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No valid fields to update' }, 400);
  }

  const [updated] = await db
    .update(calendars)
    .set(updates)
    .where(eq(calendars.id, calendarId))
    .returning();

  if (!updated) {
    return c.json({ error: 'Calendar not found' }, 404);
  }

  const response: CalendarDto = {
    id: updated.id,
    name: updated.name,
    color: updated.color ?? null,
    isPrimary: updated.isPrimary,
    isVisible: updated.isVisible,
  };

  return c.json(response);
});
