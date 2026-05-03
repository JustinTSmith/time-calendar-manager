import { Router } from 'express'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { requireAuth } from '../middleware/auth.stub.js'

export interface StoredEvent {
  id: string
  title: string
  startAt: string
  endAt: string
  calendarId: string
  deletedAt?: string
}

export const eventsStore: StoredEvent[] = []

const createEventSchema = z.object({
  title: z.string().min(1),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  calendarId: z.string().uuid()
})

const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional()
})

const router = Router()

router.get('/', (req, res) => {
  const { calendarId } = req.query
  const active = eventsStore.filter(e => !e.deletedAt)
  res.json(calendarId ? active.filter(e => e.calendarId === calendarId) : active)
})

router.post('/', (req, res) => {
  const result = createEventSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed', issues: result.error.issues })
    return
  }
  const event: StoredEvent = { id: randomUUID(), ...result.data }
  eventsStore.push(event)
  res.status(201).json(event)
})

router.patch('/:id', requireAuth, (req, res) => {
  const event = eventsStore.find(e => e.id === req.params['id'] && !e.deletedAt)
  if (!event) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  const result = updateEventSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed', issues: result.error.issues })
    return
  }
  Object.assign(event, result.data)
  res.json(event)
})

router.delete('/:id', (req, res) => {
  const event = eventsStore.find(e => e.id === req.params['id'])
  if (!event) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  event.deletedAt = new Date().toISOString()
  res.json({ success: true })
})

export default router
