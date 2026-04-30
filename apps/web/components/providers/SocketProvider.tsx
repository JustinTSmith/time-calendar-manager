'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/lib/auth-store'

const SocketContext = createContext<Socket | null>(null)

export function useSocket() {
  return useContext(SocketContext)
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const accessToken = useAuthStore((s) => s.accessToken)

  useEffect(() => {
    if (!accessToken) {
      setSocket(null)
      return
    }

    const s = io(process.env.NEXT_PUBLIC_WS_URL!, {
      auth: { token: accessToken },
    })

    setSocket(s)

    return () => {
      s.disconnect()
    }
  }, [accessToken])

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  )
}
