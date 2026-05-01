import { env } from '../../config/env.js';

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

export interface Subscription {
  id: string;
  resource: string;
  applicationId: string;
  changeType: string;
  clientState: string;
  notificationUrl: string;
  expirationDateTime: string;
  creatorId: string;
}

export interface Notification {
  changeType: 'created' | 'updated' | 'deleted';
  clientState: string;
  resource: string;
  subscriptionId: string;
  subscriptionExpirationDateTime: string;
  resourceData: {
    '@odata.type': string;
    '@odata.id': string;
    '@odata.etag': string;
    id: string;
  };
}

/**
 * Create a webhook subscription for calendar events
 * Microsoft Graph subscriptions have a max lifetime of 3 days
 */
export async function createSubscription(
  accessToken: string,
  calendarId: string,
  accountId: string
): Promise<Subscription> {
  // Expire in 2 days (max is 3 days)
  const expirationDateTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

  const response = await fetch(`${GRAPH_API_BASE}/subscriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      changeType: 'created,updated,deleted',
      notificationUrl: `${env.PUBLIC_URL}/api/v1/webhooks/microsoft`,
      resource: `/me/calendars/${calendarId}/events`,
      expirationDateTime,
      clientState: env.WEBHOOK_SECRET,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create subscription: ${error}`);
  }

  return response.json();
}

/**
 * Renew an existing subscription
 */
export async function renewSubscription(
  accessToken: string,
  subscriptionId: string,
  newExpirationDate: Date
): Promise<void> {
  const response = await fetch(`${GRAPH_API_BASE}/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      expirationDateTime: newExpirationDate.toISOString(),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to renew subscription: ${error}`);
  }
}

/**
 * Delete a subscription
 */
export async function deleteSubscription(
  accessToken: string,
  subscriptionId: string
): Promise<void> {
  const response = await fetch(`${GRAPH_API_BASE}/subscriptions/${subscriptionId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const error = await response.text();
    throw new Error(`Failed to delete subscription: ${error}`);
  }
}

/**
 * Validate webhook notification
 */
export function validateNotification(notification: Notification): boolean {
  return notification.clientState === env.WEBHOOK_SECRET;
}

/**
 * Parse webhook payload
 */
export function parseWebhookPayload(body: unknown): Notification[] {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Invalid webhook payload');
  }

  const payload = body as { value?: unknown[] };
  
  if (!Array.isArray(payload.value)) {
    throw new Error('Invalid webhook payload: expected value array');
  }

  return payload.value as Notification[];
}
