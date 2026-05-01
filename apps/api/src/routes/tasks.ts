import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, tasks } from '@time-calendar-manager/db';
import { getIO } from '../socket.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

// GET /tasks - List tasks for user
router.get('/', verifyToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const { status, listId } = req.query;

    const userTasks = await db.query.tasks.findMany({
      where: (tasks, { and, eq, isNull }) => {
        const conditions = [eq(tasks.userId, userId), isNull(tasks.deletedAt)];
        if (status) {
          conditions.push(eq(tasks.status, status as string));
        }
        if (listId) {
          conditions.push(eq(tasks.listId, listId as string));
        }
        return and(...conditions);
      },
    });

    res.json(userTasks);
  } catch (error) {
    console.error('[API] Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST /tasks - Create a new task
router.post('/', verifyToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const {
      listId,
      title,
      dueDate,
      durationMinutes,
      priority,
      tags,
    } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const [newTask] = await db
      .insert(tasks)
      .values({
        userId,
        listId,
        title,
        dueDate: dueDate ? new Date(dueDate) : null,
        durationMinutes: durationMinutes || 30,
        priority: priority || 3,
        tags: tags || [],
        status: 'inbox',
      })
      .returning();

    res.status(201).json(newTask);
  } catch (error) {
    console.error('[API] Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PATCH /tasks/:id - Update a task
router.patch('/:id', verifyToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const taskId = req.params.id;
    const updateData = req.body;

    // Convert date strings to Date objects if present
    if (updateData.dueDate) {
      updateData.dueDate = new Date(updateData.dueDate);
    }

    const [updatedTask] = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, taskId))
      .returning();

    if (!updatedTask) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Emit socket event to notify clients
    const io = getIO();
    io.to(userId).emit('task:updated', { taskId });

    res.json(updatedTask);
  } catch (error) {
    console.error('[API] Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /tasks/:id - Delete a task (soft delete)
router.delete('/:id', verifyToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId!;
    const taskId = req.params.id;

    const [deletedTask] = await db
      .update(tasks)
      .set({ deletedAt: new Date() })
      .where(eq(tasks.id, taskId))
      .returning();

    if (!deletedTask) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.json({ success: true, taskId });
  } catch (error) {
    console.error('[API] Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
