import { db, taskLists, tasks } from '@time-calendar-manager/db'
import { and, eq, isNull } from 'drizzle-orm'
import { Router, type IRouter } from 'express'
import { createTaskListSchema, updateTaskListSchema } from '../lib/validation.js'
import { requireAuth } from '../middleware/auth.js'

const router: IRouter = Router()

router.use(requireAuth)

router.get('/', async (req, res) => {
  try {
    const lists = await db
      .select()
      .from(taskLists)
      .where(and(eq(taskLists.userId, req.userId), isNull(taskLists.archivedAt)))
    res.json({ data: lists })
  } catch {
    res.status(500).json({ error: 'Failed to fetch task lists' })
  }
})

router.post('/', async (req, res) => {
  const result = createTaskListSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed', issues: result.error.issues })
    return
  }

  try {
    const [list] = await db
      .insert(taskLists)
      .values({ userId: req.userId, ...result.data, isInbox: false })
      .returning()
    res.status(201).json({ data: list })
  } catch {
    res.status(500).json({ error: 'Failed to create task list' })
  }
})

router.patch('/:id', async (req, res) => {
  const result = updateTaskListSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed', issues: result.error.issues })
    return
  }

  const { archived, ...fields } = result.data
  const updates: Record<string, unknown> = { ...fields }
  if (archived === true) updates.archivedAt = new Date()
  if (archived === false) updates.archivedAt = null

  try {
    const [list] = await db
      .update(taskLists)
      .set(updates)
      .where(and(eq(taskLists.id, req.params.id), eq(taskLists.userId, req.userId)))
      .returning()

    if (!list) {
      res.status(404).json({ error: 'Task list not found' })
      return
    }
    res.json({ data: list })
  } catch {
    res.status(500).json({ error: 'Failed to update task list' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const [list] = await db
      .select()
      .from(taskLists)
      .where(and(eq(taskLists.id, req.params.id), eq(taskLists.userId, req.userId)))

    if (!list) {
      res.status(404).json({ error: 'Task list not found' })
      return
    }

    if (list.isInbox) {
      res.status(400).json({ error: 'Cannot delete the Inbox list' })
      return
    }

    // Move non-deleted tasks to inbox before deleting
    const [inboxList] = await db
      .select()
      .from(taskLists)
      .where(and(eq(taskLists.userId, req.userId), eq(taskLists.isInbox, true)))

    if (inboxList) {
      await db
        .update(tasks)
        .set({ listId: inboxList.id })
        .where(and(eq(tasks.listId, list.id), isNull(tasks.deletedAt)))
    }

    await db.delete(taskLists).where(eq(taskLists.id, list.id))
    res.json({ data: { deleted: true } })
  } catch {
    res.status(500).json({ error: 'Failed to delete task list' })
  }
})

export default router
