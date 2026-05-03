import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'
import { eventsStore } from './events'

const app = createApp()

const VALID_CALENDAR_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const VALID_EVENT = {
  title: 'Team standup',
  startAt: '2026-04-30T09:00:00Z',
  endAt: '2026-04-30T09:30:00Z',
  calendarId: VALID_CALENDAR_ID
}

beforeEach(() => {
  eventsStore.length = 0
})

describe('GET /events', () => {
  it('returns 200 and an empty array when no events exist', async () => {
    const res = await request(app).get('/events')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('returns all active events', async () => {
    await request(app).post('/events').send(VALID_EVENT)
    const res = await request(app).get('/events')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0]).toMatchObject({ title: 'Team standup' })
  })

  it('filters events by calendarId', async () => {
    const otherId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
    await request(app).post('/events').send(VALID_EVENT)
    await request(app).post('/events').send({ ...VALID_EVENT, title: 'Other', calendarId: otherId })

    const res = await request(app).get(`/events?calendarId=${VALID_CALENDAR_ID}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0]?.title).toBe('Team standup')
  })

  it('excludes soft-deleted events', async () => {
    const created = await request(app).post('/events').send(VALID_EVENT)
    await request(app).delete(`/events/${created.body.id}`)

    const res = await request(app).get('/events')
    expect(res.body).toHaveLength(0)
  })
})

describe('POST /events', () => {
  it('creates an event and returns 201', async () => {
    const res = await request(app).post('/events').send(VALID_EVENT)
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject(VALID_EVENT)
    expect(res.body.id).toBeDefined()
  })

  it('returns 400 when title is missing', async () => {
    const { title: _t, ...body } = VALID_EVENT
    const res = await request(app).post('/events').send(body)
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Validation failed')
  })

  it('returns 400 when calendarId is not a UUID', async () => {
    const res = await request(app).post('/events').send({ ...VALID_EVENT, calendarId: 'not-a-uuid' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when startAt is missing', async () => {
    const { startAt: _s, ...body } = VALID_EVENT
    const res = await request(app).post('/events').send(body)
    expect(res.status).toBe(400)
  })
})

describe('PATCH /events/:id', () => {
  it('returns 401 without Authorization header', async () => {
    const created = await request(app).post('/events').send(VALID_EVENT)
    const res = await request(app).patch(`/events/${created.body.id}`).send({ title: 'New title' })
    expect(res.status).toBe(401)
  })

  it('returns 200 and updates the event with valid auth', async () => {
    const created = await request(app).post('/events').send(VALID_EVENT)
    const res = await request(app)
      .patch(`/events/${created.body.id}`)
      .set('Authorization', 'Bearer test-token')
      .send({ title: 'Updated standup' })
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Updated standup')
  })

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .patch('/events/00000000-0000-0000-0000-000000000000')
      .set('Authorization', 'Bearer test-token')
      .send({ title: 'X' })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /events/:id', () => {
  it('returns 200 and soft-deletes the event', async () => {
    const created = await request(app).post('/events').send(VALID_EVENT)
    const res = await request(app).delete(`/events/${created.body.id}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(eventsStore[0]?.deletedAt).toBeDefined()
  })

  it('returns 404 for unknown id', async () => {
    const res = await request(app).delete('/events/00000000-0000-0000-0000-000000000000')
    expect(res.status).toBe(404)
  })
})
