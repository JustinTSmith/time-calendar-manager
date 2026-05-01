import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, events } from '@time-calendar-manager/db';
import { getIO } from '../socket.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

// POST /events - Create a new event
router.post('/', verifyToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const {
      calendarId,
      providerEventId,
      title,
      startAt,
      endAt,
      recurrenceRule,
      attendees,
      reminders,
      isTimeBlock,
      taskId,
    } = req.body;

    // Validate required fields
    if (!calendarId || !providerEventId || !title || !startAt || !endAt) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const [newEvent] = await db
      .insert(events)
      .values({
        userId,
        calendarId,
        providerEventId,
        title,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        recurrenceRule,
        attendees: attendees || [],
        reminders: reminders || [],
        isTimeBlock: isTimeBlock || false,
        taskId,
      })
      .returning();

    // Emit socket event to notify clients
    const io = getIO();
    io.to(userId).emit('event:created', {
      calendarId,
      eventId: newEvent.id,
    });

    res.status(201).json(newEvent);
  } catch (error) {
    console.error('[API] Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// PATCH /events/:id - Update an event
router.patch('/:id', verifyToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const eventId = req.params.id;
    const updateData = req.body;

    // Convert date strings to Date objects if present
    if (updateData.startAt) {
      updateData.startAt = new Date(updateData.startAt);
    }
    if (updateData.endAt) {
      updateData.endAt = new Date(updateData.endAt);
    }

    const [updatedEvent] = await db
      .update(events)
      .set(updateData)
      .where(eq(events.id, eventId))
      .returning();

    if (!updatedEvent) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Emit socket event to notify clients
    const io = getIO();
    io.to(userId).emit('event:updated', { eventId });

    res.json(updatedEvent);
  } catch (error) {
    console.error('[API] Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE /events/:id - Delete an event (soft delete)
router.delete('/:id', verifyToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const eventId = req.params.id;

    const [deletedEvent] = await db
      .update(events)
      .set({ deletedAt: new Date() })
      .where(eq(events.id, eventId))
      .returning();

    if (!deletedEvent) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Emit socket event to notify clients
    const io = getIO();
    io.to(userId).emit('event:deleted', { eventId });

    res.json({ success: true, eventId });
  } catch (error) {
    console.error('[API] Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// GET /events - List events for user
router.get('/', verifyToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const { calendarId, start, end } = req.query;

    let query = db.query.events.findMany({
      where: (events, { and, eq, isNull }) => {
        const conditions = [eq(events.userId, userId), isNull(events.deletedAt)];
        if (calendarId) {
          conditions.push(eq(events.calendarId, calendarId as string));
        }
        return and(...conditions);
      },
    });

    const userEvents = await query;
    res.json(userEvents);
  } catch (error) {
    console.error('[API] Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

export default router;
