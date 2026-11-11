import { useState } from 'react'
import { useAuth } from '../stores/auth.store'

const inputCls = 'w-full border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500'

function Section({ kind }: { kind: 'password' | 'pin' }): React.JSX.Element {
  const [current, setCurrent] = useState('')
  const [value, setValue] = useState('')
  const [again, setAgain] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const label = kind === 'password' ? 'password' : 'PIN'

  const submit = async (e: React.SyntheticEvent): Promise<void> => {
    e.preventDefault()
    setMsg(null)
    if (kind === 'password' && value.length < 6)
      return setMsg({ ok: false, text: 'New password must be at least 6 characters' })
    if (kind === 'pin' && !/^\d{4,8}$/.test(value))
      return setMsg({ ok: false, text: 'PIN must be 4-8 digits' })
    if (value !== again) return setMsg({ ok: false, text: 'The new values do not match' })

    setBusy(true)
    const res =
      kind === 'password'
        ? await window.api.account.changePassword(current, value)
        : await window.api.account.changePin(current, value)
    setBusy(false)
    if (!res.ok) return setMsg({ ok: false, text: res.error })
    setCurrent('')
    setValue('')
    setAgain('')
    setMsg({ ok: true, text: `${kind === 'password' ? 'Password' : 'PIN'} changed` })
  }

  return (
    <form onSubmit={submit} className="w-[26rem] space-y-3 border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-slate-800">Change {label}</h2>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">Current password</span>
        <input type="password" className={inputCls} value={current} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">
          {kind === 'password' ? 'New password' : 'New PIN (4-8 digits)'}
        </span>
        <input
          type={kind === 'password' ? 'password' : 'text'}
          inputMode={kind === 'pin' ? 'numeric' : undefined}
          className={inputCls}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-600">Repeat new {label}</span>
        <input
          type={kind === 'password' ? 'password' : 'text'}
          inputMode={kind === 'pin' ? 'numeric' : undefined}
          className={inputCls}
          value={again}
          onChange={(e) => setAgain(e.target.value)}
        />
      </label>
      {msg && <p className={msg.ok ? 'text-sm text-green-700' : 'text-sm text-red-600'}>{msg.text}</p>}
      <button type="submit" disabled={busy} className="bg-blue-600 px-6 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        {busy ? 'Saving...' : `Change ${label}`}
      </button>
    </form>
  )
}

export default function AccountPage(): React.JSX.Element {
  const user = useAuth((s) => s.user)
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">My account</h1>
      <p className="mb-4 text-sm text-slate-500">
        {user?.name} ({user?.username}) · <span className="capitalize">{user?.role}</span>
      </p>
      <div className="flex flex-wrap gap-6">
        <Section kind="password" />
        <Section kind="pin" />
      </div>
    </div>
  )
}