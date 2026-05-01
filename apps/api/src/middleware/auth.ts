import type { NextFunction, Request, Response } from 'express'

declare global {
  namespace Express {
    interface Request {
      userId: string
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const userId = req.headers['x-user-id']
  if (!userId || typeof userId !== 'string') {
    res.status(401).json({ error: 'Missing X-User-Id header' })
    return
  }

  req.userId = userId
  next()
}
