// Staff sign-in page (route: /login).
//
// Identity entry and exit only: it calls the browser helpers in src/lib/auth/,
// which create or clear the Supabase Auth session. It loads no scouting or
// medical data. Protecting data is the server's job (require-session) plus RLS,
// in later steps.
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { signIn } from '#/lib/auth/sign-in'
import { signOut } from '#/lib/auth/sign-out'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    setNotice(null)
    const result = await signIn(email, password)
    setPending(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setPassword('')
    navigate({ to: '/' })
  }

  async function onSignOut() {
    setPending(true)
    setError(null)
    setNotice(null)
    const result = await signOut()
    setPending(false)
    if (result.ok) setNotice('Signed out.')
    else setError(result.message)
  }

  return (
    <section className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-slate-900">Staff sign-in</h1>
      <p className="mt-2 text-sm text-slate-600">Hockey operations: use your staff email and password.</p>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4" noValidate>
        <label className="grid gap-1 text-sm">
          Email
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            className="rounded border border-slate-300 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Password
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            className="rounded border border-slate-300 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm text-green-700">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Working…' : 'Sign in'}
        </button>
      </form>

      <button
        type="button"
        onClick={onSignOut}
        disabled={pending}
        className="mt-4 text-sm text-sky-700 underline disabled:opacity-50"
      >
        Sign out
      </button>
    </section>
  )
}
