import { env } from '../../config/env.js';

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

export interface MicrosoftCalendar {
  id: string;
  name: string;
  color?: string;
  isDefaultCalendar: boolean;
  canEdit: boolean;
}

export interface MicrosoftEvent {
  id: string;
  subject: string;
  body?: {
    contentType: string;
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  isAllDay: boolean;
  recurrence?: {
    pattern: {
      type: string;
      interval: number;
      month?: number;
      dayOfMonth?: number;
      daysOfWeek?: string[];
      firstDayOfWeek?: string;
      index?: string;
    };
    range: {
      type: string;
      startDate: string;
      endDate?: string;
      numberOfOccurrences?: number;
    };
  };
  attendees?: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
    type: string;
    status: {
      response: string;
      time: string;
    };
  }>;
  location?: {
    displayName: string;
  };
  isCancelled: boolean;
  createdDateTime: string;
  lastModifiedDateTime: string;
  categories?: string[];
  sensitivity: string;
}

export interface DeltaResponse {
  events: MicrosoftEvent[];
  deltaToken: string | null;
  nextLink: string | null;
}

/**
 * Make authenticated request to Microsoft Graph API
 */
async function graphRequest<T>(
  accessToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${GRAPH_API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Graph API error (${response.status}): ${error}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

/**
 * Get all calendars for the user
 */
export async function getCalendars(accessToken: string): Promise<MicrosoftCalendar[]> {
  interface CalendarsResponse {
    value: MicrosoftCalendar[];
    '@odata.nextLink'?: string;
  }

  const calendars: MicrosoftCalendar[] = [];
  let nextLink: string | undefined = `${GRAPH_API_BASE}/me/calendars`;

  while (nextLink) {
    const response = await graphRequest<CalendarsResponse>(accessToken, nextLink);
    calendars.push(...response.value);
    nextLink = response['@odata.nextLink'];
  }

  return calendars;
}

/**
 * Get events from a calendar with pagination
 */
export async function getEvents(
  accessToken: string,
  calendarId: string,
  options: {
    top?: number;
    select?: string[];
    filter?: string;
  } = {}
): Promise<MicrosoftEvent[]> {
  interface EventsResponse {
    value: MicrosoftEvent[];
    '@odata.nextLink'?: string;
  }

  const params = new URLSearchParams();
  params.set('$top', String(options.top || 100));
  
  if (options.select) {
    params.set('$select', options.select.join(','));
  }
  
  if (options.filter) {
    params.set('$filter', options.filter);
  }

  const events: MicrosoftEvent[] = [];
  let nextLink: string | undefined = `${GRAPH_API_BASE}/me/calendars/${calendarId}/events?${params.toString()}`;

  while (nextLink) {
    const response = await graphRequest<EventsResponse>(accessToken, nextLink);
    events.push(...response.value);
    nextLink = response['@odata.nextLink'];
  }

  return events;
}

/**
 * Get events using delta query for incremental sync
 */
export async function getDeltaEvents(
  accessToken: string,
  calendarId: string,
  deltaToken?: string
): Promise<DeltaResponse> {
  interface DeltaResponseRaw {
    value: MicrosoftEvent[];
    '@odata.deltaLink'?: string;
    '@odata.nextLink'?: string;
  }

  const params = new URLSearchParams();
  params.set('$select', 'id,subject,body,start,end,isAllDay,recurrence,attendees,location,isCancelled,createdDateTime,lastModifiedDateTime,categories,sensitivity');
  params.set('$top', '100');

  let url: string;
  if (deltaToken) {
    url = `${GRAPH_API_BASE}/me/calendars/${calendarId}/events/delta?$deltatoken=${encodeURIComponent(deltaToken)}`;
  } else {
    url = `${GRAPH_API_BASE}/me/calendars/${calendarId}/events/delta?${params.toString()}`;
  }

  const response = await graphRequest<DeltaResponseRaw>(accessToken, url);

  // Extract delta token from deltaLink
  let newDeltaToken: string | null = null;
  if (response['@odata.deltaLink']) {
    const deltaUrl = new URL(response['@odata.deltaLink']);
    newDeltaToken = deltaUrl.searchParams.get('$deltatoken') || 
                    deltaUrl.searchParams.get('deltatoken');
  }

  return {
    events: response.value,
    deltaToken: newDeltaToken,
    nextLink: response['@odata.nextLink'] || null,
  };
}

/**
 * Create a new event
 */
export async function createEvent(
  accessToken: string,
  calendarId: string,
  event: Partial<MicrosoftEvent>
): Promise<MicrosoftEvent> {
  return graphRequest<MicrosoftEvent>(
    accessToken,
    `/me/calendars/${calendarId}/events`,
    {
      method: 'POST',
      body: JSON.stringify(event),
    }
  );
}

/**
 * Update an existing event
 */
export async function updateEvent(
  accessToken: string,
  eventId: string,
  changes: Partial<MicrosoftEvent>
): Promise<MicrosoftEvent> {
  return graphRequest<MicrosoftEvent>(
    accessToken,
    `/me/events/${eventId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(changes),
    }
  );
}

/**
 * Delete an event
 */
export async function deleteEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  await graphRequest<void>(
    accessToken,
    `/me/events/${eventId}`,
    {
      method: 'DELETE',
    }
  );
}

/**
 * Convert Microsoft recurrence to RRULE format
 */
export function convertRecurrenceToRRULE(recurrence: MicrosoftEvent['recurrence']): string | undefined {
  if (!recurrence) return undefined;

  const { pattern, range } = recurrence;
  const parts: string[] = ['RRULE:FREQ='];

  // Map pattern type to RRULE frequency
  const freqMap: Record<string, string> = {
    daily: 'DAILY',
    weekly: 'WEEKLY',
    absoluteMonthly: 'MONTHLY',
    relativeMonthly: 'MONTHLY',
    absoluteYearly: 'YEARLY',
    relativeYearly: 'YEARLY',
  };

  parts.push(freqMap[pattern.type] || 'DAILY');

  // Interval
  if (pattern.interval > 1) {
    parts.push(`;INTERVAL=${pattern.interval}`);
  }

  // Days of week
  if (pattern.daysOfWeek?.length) {
    const dayMap: Record<string, string> = {
      sunday: 'SU',
      monday: 'MO',
      tuesday: 'TU',
      wednesday: 'WE',
      thursday: 'TH',
      friday: 'FR',
      saturday: 'SA',
    };
    const byday = pattern.daysOfWeek.map(d => dayMap[d.toLowerCase()] || d).join(',');
    parts.push(`;BYDAY=${byday}`);
  }

  // Day of month
  if (pattern.dayOfMonth) {
    parts.push(`;BYMONTHDAY=${pattern.dayOfMonth}`);
  }

  // End condition
  if (range.type === 'endDate' && range.endDate) {
    parts.push(`;UNTIL=${range.endDate.replace(/-/g, '')}`);
  } else if (range.type === 'numbered' && range.numberOfOccurrences) {
    parts.push(`;COUNT=${range.numberOfOccurrences}`);
  }

  return parts.join('');
}

/**
 * Convert RRULE to Microsoft recurrence format
 */
export function convertRRULEToRecurrence(rrule: string): MicrosoftEvent['recurrence'] {
  // Parse RRULE and convert to Microsoft format
  // This is a simplified implementation
  const parts = rrule.replace('RRULE:', '').split(';');
  const params = new Map<string, string>();
  
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key && value) {
      params.set(key, value);
    }
  }

  const freq = params.get('FREQ')?.toLowerCase();
  const interval = parseInt(params.get('INTERVAL') || '1', 10);
  const count = params.get('COUNT');
  const until = params.get('UNTIL');
  const byday = params.get('BYDAY');

  // Map frequency
  const typeMap: Record<string, string> = {
    daily: 'daily',
    weekly: 'weekly',
    monthly: 'absoluteMonthly',
    yearly: 'absoluteYearly',
  };

  const pattern: MicrosoftEvent['recurrence']['pattern'] = {
    type: typeMap[freq || 'daily'] || 'daily',
    interval,
  };

  if (byday) {
    const dayMap: Record<string, string> = {
      SU: 'sunday',
      MO: 'monday',
      TU: 'tuesday',
      WE: 'wednesday',
      TH: 'thursday',
      FR: 'friday',
      SA: 'saturday',
    };
    pattern.daysOfWeek = byday.split(',').map(d => {
      // Handle cases like "2MO" (second Monday)
      const dayCode = d.replace(/^\d+/, '');
      return dayMap[dayCode] || dayCode.toLowerCase();
    });
  }

  const range: MicrosoftEvent['recurrence']['range'] = {
    type: 'noEnd',
    startDate: new Date().toISOString().split('T')[0],
  };

  if (until) {
    range.type = 'endDate';
    range.endDate = `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}`;
  } else if (count) {
    range.type = 'numbered';
    range.numberOfOccurrences = parseInt(count, 10);
  }

  return { pattern, range };
}
