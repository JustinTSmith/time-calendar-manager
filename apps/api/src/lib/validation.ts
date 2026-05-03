import { z } from 'zod'

export const createTaskListSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
})

export const updateTaskListSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
  archived: z.boolean().optional(),
})

export const createTaskSchema = z.object({
  title: z.string().min(1),
  listId: z.string().uuid().optional(),
  parentTaskId: z.string().uuid().optional(),
  dueDate: z.string().datetime({ offset: true }).optional(),
  durationMinutes: z.number().int().positive().optional(),
  priority: z.number().int().min(1).max(4).optional(),
  tags: z.array(z.string()).optional(),
})

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  listId: z.string().uuid().nullable().optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
  status: z.enum(['inbox', 'scheduled', 'done']).optional(),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
  durationMinutes: z.number().int().positive().optional(),
  priority: z.number().int().min(1).max(4).optional(),
  tags: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
})

export const scheduleTaskSchema = z.object({
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
})

export const listTasksQuerySchema = z.object({
  status: z.enum(['inbox', 'scheduled', 'done']).optional(),
  list_id: z.string().uuid().optional(),
  due_before: z.string().datetime({ offset: true }).optional(),
  due_after: z.string().datetime({ offset: true }).optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})
