import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, calendarAccounts } from '@time-calendar-manager/db';
import { getIO } from '../socket.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

// POST /sync/:accountId - Trigger a calendar sync
router.post('/:accountId', verifyToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const accountId = req.params.accountId;

    // Verify the account belongs to the user
    const account = await db.query.calendarAccounts.findFirst({
      where: eq(calendarAccounts.id, accountId),
    });

    if (!account) {
      res.status(404).json({ error: 'Calendar account not found' });
      return;
    }

    if (account.userId !== userId) {
      res.status(403).json({ error: 'Forbidden: Account does not belong to user' });
      return;
    }

    // Simulate sync process (in production, this would trigger a background job)
    console.log(`[Sync] Starting sync for account ${accountId} (user ${userId})`);

    // Update sync status
    await db
      .update(calendarAccounts)
      .set({ status: 'syncing' })
      .where(eq(calendarAccounts.id, accountId));

    // Simulate async sync operation
    setTimeout(async () => {
      try {
        // Update account status after sync
        await db
          .update(calendarAccounts)
          .set({
            status: 'active',
            syncCursor: new Date().toISOString(),
          })
          .where(eq(calendarAccounts.id, accountId));

        // Emit socket event to notify clients that sync is complete
        const io = getIO();
        io.to(userId).emit('calendar:sync_complete', { accountId });

        console.log(`[Sync] Completed sync for account ${accountId}`);
      } catch (error) {
        console.error(`[Sync] Error completing sync for account ${accountId}:`, error);

        // Mark as error
        await db
          .update(calendarAccounts)
          .set({ status: 'error' })
          .where(eq(calendarAccounts.id, accountId));
      }
    }, 2000); // Simulate 2 second sync delay

    res.json({
      success: true,
      message: 'Sync initiated',
      accountId,
    });
  } catch (error) {
    console.error('[API] Error triggering sync:', error);
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

export default router;
