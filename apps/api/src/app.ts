import express, { type Application } from 'express'
import eventsRouter from './routes/events.stub.js'
import tasksRouter from './routes/tasks.stub.js'

export function createApp(): Application {
  const app = express()
  app.use(express.json())
  app.use('/events', eventsRouter)
  app.use('/tasks', tasksRouter)
  return app
}
