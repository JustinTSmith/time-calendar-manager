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
  const result = createTaskSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed', issues: result.error.issues })
    return
  }
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
  const result = updateTaskSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed', issues: result.error.issues })
    return
  }
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
})

export default router
