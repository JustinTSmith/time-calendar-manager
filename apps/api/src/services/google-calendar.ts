import { google } from 'googleapis'

export interface CalendarEvent {
  id?: string | null
  summary?: string | null
  start?: { dateTime?: string | null }
  end?: { dateTime?: string | null }
}

export class GoogleCalendarService {
  private calendar: ReturnType<typeof google.calendar>

  constructor(oauth2Client: ConstructorParameters<typeof google.auth.OAuth2>[0] extends never ? never : InstanceType<typeof google.auth.OAuth2>) {
    this.calendar = google.calendar({ version: 'v3', auth: oauth2Client as any })
  }

  async sync(
    calendarId: string,
    syncToken?: string
  ): Promise<{ events: CalendarEvent[]; nextSyncToken: string }> {
    const params: Record<string, unknown> = { calendarId, singleEvents: true }
    if (syncToken) params['syncToken'] = syncToken

    const response = await this.calendar.events.list(params as any)
    return {
      events: (response.data.items ?? []) as CalendarEvent[],
      nextSyncToken: response.data.nextSyncToken ?? ''
    }
  }

  async upsertEvent(calendarId: string, event: CalendarEvent): Promise<CalendarEvent> {
    if (event.id) {
      await this.calendar.events.update({
        calendarId,
        eventId: event.id,
        requestBody: event as any
      })
    } else {
      const res = await this.calendar.events.insert({
        calendarId,
        requestBody: event as any
      })
      return res.data as CalendarEvent
    }
    return event
  }
}
