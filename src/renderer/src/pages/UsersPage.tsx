import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Pencil, Plus } from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuth } from '../stores/auth.store'
import type { Role, UserDTO } from '../../../shared/types'

const inputCls = 'w-full border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500'

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-slate-600">{label}</span>
      {children}
    </label>
  )
}

// ---------- Add / edit user ----------
function UserFormModal({
  user,
  isSelf,
  onClose,
  onSaved
}: {
  user: UserDTO | null
  isSelf: boolean
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [name, setName] = useState(user?.name ?? '')
  const [username, setUsername] = useState(user?.username ?? '')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [role, setRole] = useState<Role>(user?.role ?? 'cashier')
  const [active, setActive] = useState(user?.isActive ?? true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async (e: React.SyntheticEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Name is required')

    if (!user) {
      if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username.trim()))
        return setError('Username: 3-30 letters, numbers, . _ -')
      if (password.length < 6) return setError('Password must be at least 6 characters')
      if (pin && !/^\d{4,8}$/.test(pin)) return setError('PIN must be 4-8 digits')
    }

    setBusy(true)
    const res = user
      ? await window.api.users.update({ id: user.id, name, role, isActive: active })
      : await window.api.users.create({ name, username, password, pin: pin || null, role })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form onSubmit={save} className="w-[28rem] space-y-4 border border-slate-300 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-slate-800">{user ? 'Edit user' : 'Add user'}</h2>

        <Field label="Full name">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>

        <Field label="Username (used to log in)">
          <input
            className={cn(inputCls, user && 'bg-slate-100')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={!!user}
          />
        </Field>

        {!user && (
          <>
            <Field label="Password (min 6 characters)">
              <input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label="PIN (4-8 digits, optional)">
              <input className={inputCls} value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" />
            </Field>
          </>
        )}

        <Field label="Role">
          <select
            className={inputCls}
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            disabled={isSelf}
          >
            <option value="cashier">Cashier</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </Field>

        {user && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={isSelf} />
            Active (can log in)
          </label>
        )}
        {isSelf && <p className="text-xs text-slate-500">You cannot change your own role or deactivate yourself.</p>}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="border border-slate-300 py-2.5 hover:bg-slate-100">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ---------- Reset password / PIN ----------
function SecretModal({
  user,
  kind,
  onClose
}: {
  user: UserDTO
  kind: 'password' | 'pin'
  onClose: () => void
}): React.JSX.Element {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const save = async (e: React.SyntheticEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    if (kind === 'password' && value.length < 6) return setError('At least 6 characters')
    if (kind === 'pin' && !/^\d{4,8}$/.test(value)) return setError('PIN must be 4-8 digits')
    setBusy(true)
    const res =
      kind === 'password'
        ? await window.api.users.resetPassword(user.id, value)
        : await window.api.users.resetPin(user.id, value)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setDone(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form onSubmit={save} className="w-[24rem] space-y-4 border border-slate-300 bg-white p-6 shadow-xl">
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            Reset {kind === 'password' ? 'password' : 'PIN'}
          </h2>
          <p className="text-sm text-slate-500">
            {user.name} ({user.username})
          </p>
        </div>

        {done ? (
          <>
            <p className="text-sm text-green-700">Saved.</p>
            <button type="button" onClick={onClose} className="w-full bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700">
              Close
            </button>
          </>
        ) : (
          <>
            <Field label={kind === 'password' ? 'New password' : 'New PIN (4-8 digits)'}>
              <input
                type={kind === 'password' ? 'password' : 'text'}
                inputMode={kind === 'pin' ? 'numeric' : undefined}
                className={inputCls}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
              />
            </Field>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={onClose} className="border border-slate-300 py-2.5 hover:bg-slate-100">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {busy ? 'Saving...' : 'Save'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}

// ---------- Page ----------
export default function UsersPage(): React.JSX.Element {
  const qc = useQueryClient()
  const me = useAuth((s) => s.user)
  const [form, setForm] = useState<UserDTO | 'new' | null>(null)
  const [secret, setSecret] = useState<{ user: UserDTO; kind: 'password' | 'pin' } | null>(null)

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await window.api.users.list()
      if (!res.ok) throw new Error(res.error)
      return res.data
    }
  })

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Users</h1>
        <button
          onClick={() => setForm('new')}
          className="flex items-center gap-2 bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} /> Add user
        </button>
      </div>

      {isLoading && <p className="text-slate-500">Loading...</p>}
      {error && <p className="text-red-600">{(error as Error).message}</p>}

      <div className="border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Username</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-800">
                  {u.name}
                  {u.id === me?.id && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                </td>
                <td className="px-4 py-2 text-slate-600">{u.username}</td>
                <td className="px-4 py-2 capitalize">{u.role}</td>
                <td className="px-4 py-2">
                  <span
                    className={cn(
                      'px-2 py-0.5 text-xs',
                      u.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'
                    )}
                  >
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-1">
                    <button title="Edit" onClick={() => setForm(u)} className="border border-slate-300 p-1.5 hover:bg-slate-100">
                      <Pencil size={14} />
                    </button>
                    <button title="Reset password" onClick={() => setSecret({ user: u, kind: 'password' })} className="border border-slate-300 p-1.5 hover:bg-slate-100">
                      <KeyRound size={14} />
                    </button>
                    <button title="Reset PIN" onClick={() => setSecret({ user: u, kind: 'pin' })} className="border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100">
                      PIN
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <UserFormModal
          user={form === 'new' ? null : form}
          isSelf={form !== 'new' && form.id === me?.id}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null)
            qc.invalidateQueries({ queryKey: ['users'] })
          }}
        />
      )}
      {secret && <SecretModal user={secret.user} kind={secret.kind} onClose={() => setSecret(null)} />}
    </div>
  )
}