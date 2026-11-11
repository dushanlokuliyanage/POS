import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../stores/auth.store'

export default function LoginPage(): React.JSX.Element {
  const { user, login } = useAuth()
  const [username, setUsername] = useState('')
  const [secret, setSecret] = useState('')
  const [usePin, setUsePin] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  const submit = async (e: React.SyntheticEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await login(username, secret, usePin)
    if (err) setError(err)
    setBusy(false)
  }

  return (
    <div className="flex h-full items-center justify-center bg-slate-100">
      <form onSubmit={submit} className="w-96 space-y-4 rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-slate-800">POS Login</h1>

        <div>
          <label className="mb-1 block text-sm text-slate-600">Username</label>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-600">
            {usePin ? 'PIN' : 'Password'}
          </label>
          <input
            type="password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? 'Signing in...' : 'Sign in'}
        </button>

        <button
          type="button"
          onClick={() => {
            setUsePin(!usePin)
            setSecret('')
            setError(null)
          }}
          className="w-full text-sm text-blue-600 hover:underline"
        >
          {usePin ? 'Use password instead' : 'Use PIN instead'}
        </button>
      </form>
    </div>
  )
}