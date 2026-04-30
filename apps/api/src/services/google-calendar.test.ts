import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GoogleCalendarService } from './google-calendar'

const mockEventsList = vi.fn()
const mockEventsUpdate = vi.fn()
const mockEventsInsert = vi.fn()

vi.mock('googleapis', () => ({
  google: {
    calendar: vi.fn(() => ({
      events: {
        list: mockEventsList,
        update: mockEventsUpdate,
        insert: mockEventsInsert
      }
    }))
  }
}))

const fakeOAuth2Client = {} as any

describe('GoogleCalendarService', () => {
  let service: GoogleCalendarService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new GoogleCalendarService(fakeOAuth2Client)
  })

  describe('sync()', () => {
    it('calls events.list with the given calendarId', async () => {
      mockEventsList.mockResolvedValueOnce({
        data: { items: [], nextSyncToken: 'tok1' }
      })
      await service.sync('primary')
      expect(mockEventsList).toHaveBeenCalledWith(
        expect.objectContaining({ calendarId: 'primary' })
      )
    })

    it('passes syncToken through when provided', async () => {
      mockEventsList.mockResolvedValueOnce({
        data: { items: [], nextSyncToken: 'tok2' }
      })
      await service.sync('primary', 'existing-token')
      expect(mockEventsList).toHaveBeenCalledWith(
        expect.objectContaining({ syncToken: 'existing-token' })
      )
    })

    it('omits syncToken when not provided', async () => {
      mockEventsList.mockResolvedValueOnce({
        data: { items: [], nextSyncToken: 'tok3' }
      })
      await service.sync('primary')
      const call = mockEventsList.mock.calls[0]?.[0] as Record<string, unknown>
      expect(call).not.toHaveProperty('syncToken')
    })

    it('returns events from the response', async () => {
      const fakeEvents = [
        { id: 'e1', summary: 'Meeting', start: { dateTime: '2026-04-30T10:00:00Z' } }
      ]
      mockEventsList.mockResolvedValueOnce({
        data: { items: fakeEvents, nextSyncToken: 'tok4' }
      })
      const { events } = await service.sync('primary')
      expect(events).toEqual(fakeEvents)
    })

    it('returns nextSyncToken from the response', async () => {
      mockEventsList.mockResolvedValueOnce({
        data: { items: [], nextSyncToken: 'next-token-xyz' }
      })
      const { nextSyncToken } = await service.sync('primary')
      expect(nextSyncToken).toBe('next-token-xyz')
    })

    it('returns empty events array when items is undefined', async () => {
      mockEventsList.mockResolvedValueOnce({ data: { nextSyncToken: 'tok' } })
      const { events } = await service.sync('primary')
      expect(events).toEqual([])
    })
  })

  describe('upsertEvent()', () => {
    it('calls events.update when event has an id', async () => {
      mockEventsUpdate.mockResolvedValueOnce({ data: {} })
      const event = { id: 'existing-id', summary: 'Updated' }
      await service.upsertEvent('primary', event)
      expect(mockEventsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ calendarId: 'primary', eventId: 'existing-id' })
      )
      expect(mockEventsInsert).not.toHaveBeenCalled()
    })

    it('calls events.insert when event has no id', async () => {
      mockEventsInsert.mockResolvedValueOnce({ data: { id: 'new-id', summary: 'New' } })
      const event = { summary: 'New Event' }
      const result = await service.upsertEvent('primary', event)
      expect(mockEventsInsert).toHaveBeenCalledWith(
        expect.objectContaining({ calendarId: 'primary' })
      )
      expect(result).toMatchObject({ id: 'new-id' })
    })

    it('returns the original event after update', async () => {
      mockEventsUpdate.mockResolvedValueOnce({ data: {} })
      const event = { id: 'e1', summary: 'My Event' }
      const result = await service.upsertEvent('primary', event)
      expect(result).toEqual(event)
    })
  })
})
