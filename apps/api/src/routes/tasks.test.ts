import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'
import { tasksStore } from './tasks.stub'

const app = createApp()

const VALID_TASK = { title: 'Write unit tests' }

beforeEach(() => {
  tasksStore.length = 0
})

describe('GET /tasks', () => {
  it('returns 200 and an empty array when no tasks exist', async () => {
    const res = await request(app).get('/tasks')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('returns all active tasks', async () => {
    await request(app).post('/tasks').send(VALID_TASK)
    const res = await request(app).get('/tasks')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0]).toMatchObject({ title: 'Write unit tests', status: 'inbox' })
  })

  it('excludes soft-deleted tasks', async () => {
    const created = await request(app).post('/tasks').send(VALID_TASK)
    await request(app).delete(`/tasks/${created.body.id}`)
    const res = await request(app).get('/tasks')
    expect(res.body).toHaveLength(0)
  })
})

describe('POST /tasks', () => {
  it('creates a task with default status inbox and returns 201', async () => {
    const res = await request(app).post('/tasks').send(VALID_TASK)
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ title: 'Write unit tests', status: 'inbox' })
    expect(res.body.id).toBeDefined()
  })

  it('returns 400 when title is missing', async () => {
    const res = await request(app).post('/tasks').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Validation failed')
  })

  it('returns 400 when title is empty string', async () => {
    const res = await request(app).post('/tasks').send({ title: '' })
    expect(res.status).toBe(400)
  })

  it('accepts optional dueDate', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'Task with due date', dueDate: '2026-05-01' })
    expect(res.status).toBe(201)
    expect(res.body.dueDate).toBe('2026-05-01')
  })
})

describe('PATCH /tasks/:id', () => {
  it('transitions status from inbox to done', async () => {
    const created = await request(app).post('/tasks').send(VALID_TASK)
    const res = await request(app)
      .patch(`/tasks/${created.body.id}`)
      .send({ status: 'done' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('done')
  })

  it('transitions status inbox → scheduled', async () => {
    const created = await request(app).post('/tasks').send(VALID_TASK)
    const res = await request(app)
      .patch(`/tasks/${created.body.id}`)
      .send({ status: 'scheduled' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('scheduled')
  })

  it('rejects an invalid status value', async () => {
    const created = await request(app).post('/tasks').send(VALID_TASK)
    const res = await request(app)
      .patch(`/tasks/${created.body.id}`)
      .send({ status: 'invalid' })
    expect(res.status).toBe(400)
  })

  it('creates subtasks when subtasks array is provided', async () => {
    const created = await request(app).post('/tasks').send(VALID_TASK)
    const res = await request(app)
      .patch(`/tasks/${created.body.id}`)
      .send({ subtasks: [{ title: 'Sub 1' }, { title: 'Sub 2' }] })
    expect(res.status).toBe(200)
    expect(res.body.subtasks).toHaveLength(2)
    expect(res.body.subtasks[0]).toMatchObject({ title: 'Sub 1', status: 'inbox' })
    expect(res.body.subtasks[1]).toMatchObject({ title: 'Sub 2', status: 'inbox' })
  })

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .patch('/tasks/00000000-0000-0000-0000-000000000000')
      .send({ status: 'done' })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /tasks/:id', () => {
  it('returns 200 and soft-deletes the task', async () => {
    const created = await request(app).post('/tasks').send(VALID_TASK)
    const res = await request(app).delete(`/tasks/${created.body.id}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(tasksStore[0]?.deletedAt).toBeDefined()
  })

  it('returns 404 for unknown id', async () => {
    const res = await request(app).delete('/tasks/00000000-0000-0000-0000-000000000000')
    expect(res.status).toBe(404)
  })
})
