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

  return app
}
