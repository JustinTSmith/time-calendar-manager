import { Hono } from 'hono';
import { parseWebhookPayload, validateNotification } from '../services/microsoft/subscription-manager.js';
import { queueIncrementalSync } from '../services/calendar-sync/microsoft-sync.js';
import { env } from '../config/env.js';

export const webhookRoutes = new Hono();

/**
 * POST /api/v1/webhooks/microsoft
 * Handle Microsoft Graph change notifications
 */
webhookRoutes.post('/microsoft', async (c) => {
  try {
    const body = await c.req.json();

    // Check if this is a validation request
    const validationToken = c.req.query('validationToken');
    if (validationToken) {
      // Return the validation token as plain text
      return new Response(validationToken, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Parse notifications
    const notifications = parseWebhookPayload(body);

    // Process each notification
    for (const notification of notifications) {
      // Validate client state
      if (!validateNotification(notification)) {
        console.error('[Webhook] Invalid client state, possible spoofing attempt');
        continue;
      }

      console.log(`[Webhook] Received ${notification.changeType} notification for resource: ${notification.resource}`);

      // Extract calendar ID from resource path
      // Resource format: "/me/calendars/{calendarId}/events/{eventId}"
      const resourceMatch = notification.resource.match(/\/me\/calendars\/([^/]+)/);
      if (!resourceMatch) {
        console.error('[Webhook] Could not parse resource:', notification.resource);
        continue;
      }

      // Get account ID from subscription
      // We stored it in the subscription creation, but for now we'll use a different approach
      // In production, you'd map subscriptionId to accountId
      const subscriptionId = notification.subscriptionId;
      
      // Queue incremental sync for this account
      // We need to find the account associated with this subscription
      const { db, calendarAccounts } = await import('../lib/db.js');
      const { eq } = await import('drizzle-orm');
      
      const account = await db.query.calendarAccounts.findFirst({
        where: eq(calendarAccounts.subscriptionId, subscriptionId),
      });

      if (account) {
        await queueIncrementalSync(account.id);
        console.log(`[Webhook] Queued incremental sync for account ${account.id}`);
      } else {
        console.error(`[Webhook] No account found for subscription ${subscriptionId}`);
      }
    }

    // Return 202 Accepted quickly
    return c.body(null, 202);
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/v1/webhooks/microsoft
 * Microsoft Graph validates webhooks by sending a validation token via query param
 */
webhookRoutes.get('/microsoft', async (c) => {
  const validationToken = c.req.query('validationToken');
  
  if (!validationToken) {
    return c.json({ error: 'Missing validation token' }, 400);
  }

  // Return the validation token as plain text (required by Microsoft)
  return new Response(validationToken, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
});
