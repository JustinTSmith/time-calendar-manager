<<<<<<< HEAD
import express, { type Application } from 'express'
import { errorHandler } from './middleware/errorHandler.js'
import taskListsRouter from './routes/taskLists.js'
import tasksRouter from './routes/tasks.js'

export function createApp(): Application {
  const app = express()
  app.use(express.json())

  app.use('/api/v1/tasks', tasksRouter)
  app.use('/api/v1/task-lists', taskListsRouter)

  app.use(errorHandler)

=======
import express from 'express'
import eventsRouter from './routes/events'
import tasksRouter from './routes/tasks'

export function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/events', eventsRouter)
  app.use('/tasks', tasksRouter)
>>>>>>> origin/blocks/jus-29-test-scaffolding-vitest-unit-tests-and-playwright-e2e-smoke
  return app
}
