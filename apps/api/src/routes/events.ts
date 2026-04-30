import { Hono } from 'hono';
import { emit } from '../lib/emitter.js';
import { enqueue } from '../lib/queue.js';
import {
  GetEventsQuerySchema,
  CreateEventSchema,
  UpdateEventSchema,
  DuplicateEventSchema,
  DeleteScopeSchema,
} from '../schemas/events.js';
import {
  getUserEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  duplicateEvent,
} from '../services/events.js';

type Variables = { userId: string };

export const eventsRouter = new Hono<{ Variables: Variables }>();

eventsRouter.get('/', async (c) => {
  const query = c.req.query();
  const parsed = GetEventsQuerySchema.safeParse(query);
  if (!parsed.success) {
    return c.json({ error: 'VALIDATION_ERROR', issues: parsed.error.issues }, 400);
  }
  const userId = c.get('userId');
  const { start, end, calendar_ids } = parsed.data;
  const calendarIds = calendar_ids ? calendar_ids.split(',').map((s) => s.trim()) : undefined;
  const events = await getUserEvents(userId, new Date(start), new Date(end), calendarIds);
  return c.json(events);
});

eventsRouter.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = CreateEventSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'VALIDATION_ERROR', issues: parsed.error.issues }, 400);
  }
  const userId = c.get('userId');
  const event = await createEvent(userId, parsed.data);
  enqueue({ jobType: 'event.write', eventId: event.id, userId });
  emit('event:created', { eventId: event.id, userId });
  return c.json(event, 201);
});

eventsRouter.patch('/:id', async (c) => {
  const body = await c.req.json();
  const parsed = UpdateEventSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'VALIDATION_ERROR', issues: parsed.error.issues }, 400);
  }
  const userId = c.get('userId');
  const eventId = c.req.param('id');
  const event = await updateEvent(userId, eventId, parsed.data);
  enqueue({ jobType: 'event.write', eventId: event.id, userId });
  emit('event:updated', { eventId: event.id, userId });
  return c.json(event);
});

eventsRouter.delete('/:id', async (c) => {
  const scopeResult = DeleteScopeSchema.safeParse(c.req.query('scope') ?? 'this');
  const scope = scopeResult.success ? scopeResult.data : 'this';
  const userId = c.get('userId');
  const eventId = c.req.param('id');
  await deleteEvent(userId, eventId, scope);
  enqueue({ jobType: 'event.delete', eventId, userId });
  return c.body(null, 204);
});

eventsRouter.post('/:id/duplicate', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = DuplicateEventSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'VALIDATION_ERROR', issues: parsed.error.issues }, 400);
  }
  const userId = c.get('userId');
  const eventId = c.req.param('id');
  const event = await duplicateEvent(userId, eventId, parsed.data);
  enqueue({ jobType: 'event.write', eventId: event.id, userId });
  emit('event:created', { eventId: event.id, userId });
  return c.json(event, 201);
});
