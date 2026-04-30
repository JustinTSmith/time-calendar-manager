'use client'

import { QueryProvider } from './QueryProvider'
import { ThemeProvider } from './ThemeProvider'
import { SocketProvider } from './SocketProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryProvider>
        <SocketProvider>{children}</SocketProvider>
      </QueryProvider>
    </ThemeProvider>
  )
}
