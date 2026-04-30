import express from 'express'
import eventsRouter from './routes/events'
import tasksRouter from './routes/tasks'

export function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/events', eventsRouter)
  app.use('/tasks', tasksRouter)
  return app
}
