<<<<<<< HEAD
import {
  calendarAccounts,
  calendars,
  db,
  events,
  taskLists,
  tasks,
} from '@time-calendar-manager/db'
import {
  type SQL,
  and,
  asc,
  count,
  eq,
  gt,
  ilike,
  isNull,
  lt,
  sql,
} from 'drizzle-orm'
import { Router, type IRouter } from 'express'
import { randomUUID } from 'node:crypto'
import {
  createTaskSchema,
  listTasksQuerySchema,
  scheduleTaskSchema,
  updateTaskSchema,
} from '../lib/validation.js'
import { requireAuth } from '../middleware/auth.js'

const router: IRouter = Router()

router.use(requireAuth)

// GET /api/v1/tasks
router.get('/', async (req, res) => {
  const result = listTasksQuerySchema.safeParse(req.query)
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed', issues: result.error.issues })
    return
  }

  const { status, list_id, due_before, due_after, tag, search, page, limit } = result.data
  const offset = (page - 1) * limit

  const filters: SQL[] = [eq(tasks.userId, req.userId), isNull(tasks.deletedAt)]

  if (status) filters.push(eq(tasks.status, status))
  if (list_id) filters.push(eq(tasks.listId, list_id))
  if (due_before) filters.push(lt(tasks.dueDate, new Date(due_before)))
  if (due_after) filters.push(gt(tasks.dueDate, new Date(due_after)))
  if (tag) filters.push(sql`${tasks.tags} @> ARRAY[${tag}]::text[]`)
  if (search) filters.push(ilike(tasks.title, `%${search}%`))

  try {
    const [rows, [{ value: total }]] = await Promise.all([
      db
        .select()
        .from(tasks)
        .where(and(...filters))
        .orderBy(
          sql`${tasks.dueDate} ASC NULLS LAST`,
          asc(tasks.priority),
        )
        .limit(limit)
        .offset(offset),
      db
        .select({ value: count() })
        .from(tasks)
        .where(and(...filters)),
    ])

    res.json({ data: rows, total, page, limit })
  } catch {
    res.status(500).json({ error: 'Failed to fetch tasks' })
  }
})

// POST /api/v1/tasks
router.post('/', async (req, res) => {
=======
import { Router } from 'express'
import { z } from 'zod'
import { randomUUID } from 'crypto'

export type TaskStatus = 'inbox' | 'scheduled' | 'done'

export interface StoredTask {
  id: string
  title: string
  status: TaskStatus
  listId?: string
  dueDate?: string
  deletedAt?: string
  subtasks?: StoredTask[]
}

export const tasksStore: StoredTask[] = []

const createTaskSchema = z.object({
  title: z.string().min(1),
  listId: z.string().uuid().optional(),
  dueDate: z.string().optional()
})

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  status: z.enum(['inbox', 'scheduled', 'done']).optional(),
  dueDate: z.string().optional(),
  subtasks: z.array(z.object({ title: z.string().min(1) })).optional()
})

const router = Router()

router.get('/', (req, res) => {
  res.json(tasksStore.filter(t => !t.deletedAt))
})

router.post('/', (req, res) => {
>>>>>>> origin/blocks/jus-29-test-scaffolding-vitest-unit-tests-and-playwright-e2e-smoke
  const result = createTaskSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed', issues: result.error.issues })
    return
  }
<<<<<<< HEAD

  const { listId, dueDate, ...rest } = result.data

  try {
    let resolvedListId = listId

    if (!resolvedListId) {
      // Find or create inbox list
      let [inbox] = await db
        .select()
        .from(taskLists)
        .where(and(eq(taskLists.userId, req.userId), eq(taskLists.isInbox, true)))

      if (!inbox) {
        ;[inbox] = await db
          .insert(taskLists)
          .values({ userId: req.userId, name: 'Inbox', isInbox: true })
          .returning()
      }
      resolvedListId = inbox.id
    }

    // Compute sort order: count of non-deleted tasks in this list
    const [{ value: taskCount }] = await db
      .select({ value: count() })
      .from(tasks)
      .where(and(eq(tasks.listId, resolvedListId), isNull(tasks.deletedAt)))

    const [task] = await db
      .insert(tasks)
      .values({
        userId: req.userId,
        listId: resolvedListId,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        sortOrder: Number(taskCount),
        ...rest,
      })
      .returning()

    res.status(201).json({ data: task })
  } catch {
    res.status(500).json({ error: 'Failed to create task' })
  }
})

// PATCH /api/v1/tasks/:id
router.patch('/:id', async (req, res) => {
=======
  const task: StoredTask = { id: randomUUID(), status: 'inbox', ...result.data }
  tasksStore.push(task)
  res.status(201).json(task)
})

router.patch('/:id', (req, res) => {
  const task = tasksStore.find(t => t.id === req.params['id'] && !t.deletedAt)
  if (!task) {
    res.status(404).json({ error: 'Not found' })
    return
  }
>>>>>>> origin/blocks/jus-29-test-scaffolding-vitest-unit-tests-and-playwright-e2e-smoke
  const result = updateTaskSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed', issues: result.error.issues })
    return
  }
<<<<<<< HEAD

  const { status, dueDate, ...rest } = result.data
  const updates: Record<string, unknown> = { ...rest }

  if (status !== undefined) {
    updates.status = status
    if (status === 'done') {
      updates.completedAt = new Date()
    } else {
      updates.completedAt = null
    }
  }

  if (dueDate !== undefined) {
    updates.dueDate = dueDate ? new Date(dueDate) : null
  }

  try {
    const [task] = await db
      .update(tasks)
      .set(updates)
      .where(
        and(eq(tasks.id, req.params.id), eq(tasks.userId, req.userId), isNull(tasks.deletedAt)),
      )
      .returning()

    if (!task) {
      res.status(404).json({ error: 'Task not found' })
      return
    }

    res.json({ data: task })
  } catch {
    res.status(500).json({ error: 'Failed to update task' })
  }
})

// DELETE /api/v1/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    const [task] = await db
      .select()
      .from(tasks)
      .where(
        and(eq(tasks.id, req.params.id), eq(tasks.userId, req.userId), isNull(tasks.deletedAt)),
      )

    if (!task) {
      res.status(404).json({ error: 'Task not found' })
      return
    }

    const now = new Date()

    // Unlink from event before soft-deleting (leave event intact)
    if (task.scheduledEventId) {
      await db.update(tasks).set({ scheduledEventId: null }).where(eq(tasks.id, task.id))
    }

    // Soft-delete all subtasks
    await db
      .update(tasks)
      .set({ deletedAt: now })
      .where(and(eq(tasks.parentTaskId, task.id), isNull(tasks.deletedAt)))

    // Soft-delete the task itself
    await db.update(tasks).set({ deletedAt: now }).where(eq(tasks.id, task.id))

    res.json({ data: { deleted: true } })
  } catch {
    res.status(500).json({ error: 'Failed to delete task' })
  }
})

// POST /api/v1/tasks/:id/complete
router.post('/:id/complete', async (req, res) => {
  try {
    const [task] = await db
      .update(tasks)
      .set({ status: 'done', completedAt: new Date() })
      .where(
        and(eq(tasks.id, req.params.id), eq(tasks.userId, req.userId), isNull(tasks.deletedAt)),
      )
      .returning()

    if (!task) {
      res.status(404).json({ error: 'Task not found' })
      return
    }

    res.json({ data: task })
  } catch {
    res.status(500).json({ error: 'Failed to complete task' })
  }
})

// POST /api/v1/tasks/:id/schedule
router.post('/:id/schedule', async (req, res) => {
  const result = scheduleTaskSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed', issues: result.error.issues })
    return
  }

  const { startAt, endAt } = result.data

  try {
    const [task] = await db
      .select()
      .from(tasks)
      .where(
        and(eq(tasks.id, req.params.id), eq(tasks.userId, req.userId), isNull(tasks.deletedAt)),
      )

    if (!task) {
      res.status(404).json({ error: 'Task not found' })
      return
    }

    // Find user's primary calendar
    const [primaryCalendar] = await db
      .select({ id: calendars.id })
      .from(calendars)
      .innerJoin(calendarAccounts, eq(calendars.accountId, calendarAccounts.id))
      .where(and(eq(calendarAccounts.userId, req.userId), eq(calendars.isPrimary, true)))

    if (!primaryCalendar) {
      res.status(422).json({ error: 'No primary calendar found for user' })
      return
    }

    // Create time-block event
    const [event] = await db
      .insert(events)
      .values({
        userId: req.userId,
        calendarId: primaryCalendar.id,
        providerEventId: randomUUID(),
        title: task.title,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        isTimeBlock: true,
        taskId: task.id,
      })
      .returning()

    // Link task to event and mark as scheduled
    const [updatedTask] = await db
      .update(tasks)
      .set({ scheduledEventId: event.id, status: 'scheduled' })
      .where(eq(tasks.id, task.id))
      .returning()

    res.status(201).json({ data: { task: updatedTask, event } })
  } catch {
    res.status(500).json({ error: 'Failed to schedule task' })
  }
=======
  const { subtasks, ...fields } = result.data
  Object.assign(task, fields)
  if (subtasks?.length) {
    task.subtasks = subtasks.map(s => ({
      id: randomUUID(),
      title: s.title,
      status: 'inbox' as TaskStatus
    }))
  }
  res.json(task)
})

router.delete('/:id', (req, res) => {
  const task = tasksStore.find(t => t.id === req.params['id'])
  if (!task) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  task.deletedAt = new Date().toISOString()
  res.json({ success: true })
>>>>>>> origin/blocks/jus-29-test-scaffolding-vitest-unit-tests-and-playwright-e2e-smoke
})

export default router
