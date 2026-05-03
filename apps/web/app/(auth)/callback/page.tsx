'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'

export default function CallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state') ?? ''

    if (!code) {
      setError('Missing authorization code.')
      return
    }

    // Provider is encoded as the first segment of state: "google|<nonce>" or "microsoft|<nonce>"
    const provider = state.startsWith('microsoft') ? 'microsoft' : 'google'

    api
      .post<{ accessToken: string; user: { id: string; email: string; name: string; timezone: string } }>(
        `/auth/${provider}/callback`,
        { code, state }
    const provider = state.startsWith('google')
      ? 'google'
      : state.startsWith('microsoft')
        ? 'microsoft'
        : null

    if (!provider) {
      setError('Unknown OAuth provider. Please try again.')
      return
    }
      .then((res) => {
        setAuth(res.data.user, res.data.accessToken)
        router.replace('/calendar')
      })
      .catch(() => {
        setError('Authentication failed. Please try again.')
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-sm text-destructive">{error}</p>
        <a href="/login" className="text-sm text-primary underline-offset-4 hover:underline">
          Back to login
        </a>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}
