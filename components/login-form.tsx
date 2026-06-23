'use client'

import { useRouter } from 'next/navigation'
import { startTransition, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function LoginForm({
  initialError,
  nextPath,
}: {
  initialError: string | null
  nextPath: string
}) {
  const router = useRouter()
  const [email, setEmail] = useState('maya@demo.reed')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false)

  async function handleGoogleSignIn() {
    setIsGoogleSubmitting(true)
    setError(null)

    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    })

    if (signInError) {
      setIsGoogleSubmitting(false)
      setError(signInError.message)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    setIsSubmitting(false)

    if (signInError) {
      setError(signInError.message)
      return
    }

    startTransition(() => {
      router.push(nextPath)
      router.refresh()
    })
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <button
        className="oauth-button"
        disabled={isGoogleSubmitting || isSubmitting}
        onClick={handleGoogleSignIn}
        type="button"
      >
        <span aria-hidden="true">G</span>
        {isGoogleSubmitting ? 'Opening Google...' : 'Continue with Google'}
      </button>

      <div className="auth-divider">
        <span>or</span>
      </div>

      <div className="field-group">
        <label htmlFor="email">Email</label>
        <input
          required
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="field-group">
        <label htmlFor="password">Password</label>
        <input
          required
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {(error ?? initialError) ? (
        <div className="auth-error">
          {error ?? initialError}
        </div>
      ) : null}

      <button
        className="primary-button"
        type="submit"
        disabled={isSubmitting || isGoogleSubmitting}
      >
        {isSubmitting ? 'Signing in...' : 'Continue'}
      </button>

      <p className="auth-demo">
        Demo: maya@demo.reed · reed-demo-2024
      </p>
    </form>
  )
}
