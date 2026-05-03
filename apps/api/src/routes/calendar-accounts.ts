import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db, calendarAccounts, calendars } from '../lib/db.js';
import { syncQueue } from '../lib/queue.js';
import { getValidAccessToken } from '../services/token-manager.js';
import { deleteSubscription } from '../services/microsoft/subscription-manager.js';

export const calendarAccountRoutes = new Hono();

/**
 * GET /api/v1/calendar-accounts
 * List connected calendar accounts for a user
 */
calendarAccountRoutes.get('/', async (c) => {
  const userId = c.req.query('userId');
  
  if (!userId) {
    return c.json({ error: 'User ID required' }, 400);
  }

  try {
    const accounts = await db.query.calendarAccounts.findMany({
      where: eq(calendarAccounts.userId, userId),
      with: {
        calendars: true,
      },
    });

    // Remove sensitive data
    const sanitizedAccounts = accounts.map(account => ({
      id: account.id,
      provider: account.provider,
      status: account.status,
      createdAt: account.createdAt,
      calendars: account.calendars.map(calendar => ({
        id: calendar.id,
        name: calendar.name,
        color: calendar.color,
        isPrimary: calendar.isPrimary,
        isVisible: calendar.isVisible,
      })),
    }));

    return c.json({ accounts: sanitizedAccounts });
  } catch (error) {
    console.error('Error fetching calendar accounts:', error);
    return c.json({ error: 'Failed to fetch calendar accounts' }, 500);
  }
});

/**
 * GET /api/v1/calendar-accounts/:id
 * Get details of a specific calendar account
 */
calendarAccountRoutes.get('/:id', async (c) => {
  const accountId = c.req.param('id');
  const userId = c.req.query('userId');

  if (!userId) {
    return c.json({ error: 'User ID required' }, 400);
  }

  try {
    const account = await db.query.calendarAccounts.findFirst({
      where: eq(calendarAccounts.id, accountId),
      with: {
        calendars: true,
      },
    });

    if (!account) {
      return c.json({ error: 'Account not found' }, 404);
    }

    if (account.userId !== userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Remove sensitive data
    const sanitizedAccount = {
      id: account.id,
      provider: account.provider,
      status: account.status,
      syncCursor: account.syncCursor,
      subscriptionId: account.subscriptionId,
      subscriptionExpiresAt: account.subscriptionExpiresAt,
      createdAt: account.createdAt,
      calendars: account.calendars.map(calendar => ({
        id: calendar.id,
        name: calendar.name,
        color: calendar.color,
        isPrimary: calendar.isPrimary,
        isVisible: calendar.isVisible,
      })),
    };

    return c.json({ account: sanitizedAccount });
  } catch (error) {
    console.error('Error fetching calendar account:', error);
    return c.json({ error: 'Failed to fetch calendar account' }, 500);
  }
});

/**
 * POST /api/v1/calendar-accounts/:id/sync
 * Trigger manual sync for an account
 */
calendarAccountRoutes.post('/:id/sync', async (c) => {
  const accountId = c.req.param('id');
  const userId = c.req.query('userId');

  if (!userId) {
    return c.json({ error: 'User ID required' }, 400);
  }

  try {
    const account = await db.query.calendarAccounts.findFirst({
      where: eq(calendarAccounts.id, accountId),
    });

    if (!account) {
      return c.json({ error: 'Account not found' }, 404);
    }

    if (account.userId !== userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Queue full sync
    await syncQueue.add('microsoft-full-sync', {
      accountId,
      userId,
    }, {
      jobId: `manual-full-sync-${accountId}-${Date.now()}`,
    });

    return c.json({ message: 'Sync queued successfully' });
  } catch (error) {
    console.error('Error triggering sync:', error);
    return c.json({ error: 'Failed to trigger sync' }, 500);
  }
});

/**
 * DELETE /api/v1/calendar-accounts/:id
 * Disconnect a calendar account
 */
calendarAccountRoutes.delete('/:id', async (c) => {
  const accountId = c.req.param('id');
  const userId = c.req.query('userId');

  if (!userId) {
    return c.json({ error: 'User ID required' }, 400);
  }

  try {
    const account = await db.query.calendarAccounts.findFirst({
      where: eq(calendarAccounts.id, accountId),
    });

    if (!account) {
      return c.json({ error: 'Account not found' }, 404);
    }

    if (account.userId !== userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Delete subscription if exists
    if (account.subscriptionId) {
      try {
        const accessToken = await getValidAccessToken(accountId);
        await deleteSubscription(accessToken, account.subscriptionId);
      } catch (error) {
        console.error('Error deleting subscription:', error);
        // Continue with account deletion even if subscription deletion fails
      }
    }

    // Delete account (cascades to calendars and events)
    await db.delete(calendarAccounts).where(eq(calendarAccounts.id, accountId));

    return c.json({ message: 'Account disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting account:', error);
    return c.json({ error: 'Failed to disconnect account' }, 500);
  }
});
