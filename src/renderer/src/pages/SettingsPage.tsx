import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

const fmtSize = (n: number): string =>
  n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`

export default function SettingsPage(): React.JSX.Element {
  const qc = useQueryClient()
  const [storeName, setStoreName] = useState('')
  const [footer, setFooter] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [bMsg, setBMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [bBusy, setBBusy] = useState(false)

  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await window.api.settings.get()
      if (!res.ok) throw new Error(res.error)
      return res.data
    }
  })

  const { data: backups } = useQuery({
    queryKey: ['backups'],
    queryFn: async () => {
      const res = await window.api.backup.list()
      if (!res.ok) throw new Error(res.error)
      return res.data
    }
  })

  useEffect(() => {
    if (data) {
      setStoreName(data.storeName)
      setFooter(data.receiptFooter)
    }
  }, [data])

  const save = async (e: React.SyntheticEvent): Promise<void> => {
    e.preventDefault()
    setMsg(null)
    const res = await window.api.settings.save({ storeName, receiptFooter: footer })
    if (!res.ok) return setMsg({ ok: false, text: res.error })
    qc.invalidateQueries({ queryKey: ['settings'] })
    setMsg({ ok: true, text: 'Saved' })
  }

  const backupNow = async (): Promise<void> => {
    setBBusy(true)
    setBMsg(null)
    const res = await window.api.backup.now()
    setBBusy(false)
    if (!res.ok) return setBMsg({ ok: false, text: res.error })
    if (res.data) setBMsg({ ok: true, text: `Backup saved: ${res.data}` })
  }

  const restore = async (): Promise<void> => {
    setBMsg(null)
    const res = await window.api.backup.restore()
    if (!res.ok) return setBMsg({ ok: false, text: res.error })
    if (!res.data) setBMsg({ ok: true, text: 'Restore cancelled' })
    // on success the app closes and restarts by itself
  }

  const openFolder = async (): Promise<void> => {
    await window.api.backup.openFolder()
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-2xl font-bold text-slate-800">Settings</h1>
        <form onSubmit={save} className="w-[30rem] space-y-4 border border-slate-200 bg-white p-6">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">Store name (shown on receipts)</span>
            <input
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-slate-600">Receipt footer message</span>
            <input
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              className="w-full border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            />
          </label>
          {msg && <p className={msg.ok ? 'text-sm text-green-700' : 'text-sm text-red-600'}>{msg.text}</p>}
          <button type="submit" className="bg-blue-600 px-6 py-2.5 font-medium text-white hover:bg-blue-700">
            Save settings
          </button>
        </form>
      </div>

      <div>
        <h2 className="mb-4 text-xl font-bold text-slate-800">Backup and restore</h2>
        <div className="w-[40rem] space-y-4 border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-600">
            A backup is saved automatically once a day when the app starts (last 14 are kept). Make
            a manual copy to a USB drive or cloud folder as well.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={backupNow}
              disabled={bBusy}
              className="bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {bBusy ? 'Saving...' : 'Backup now'}
            </button>
            <button
              onClick={restore}
              className="border border-red-600 px-5 py-2.5 font-medium text-red-600 hover:bg-red-50"
            >
              Restore from file
            </button>
            <button
              onClick={openFolder}
              className="border border-slate-300 px-5 py-2.5 hover:bg-slate-100"
            >
              Open backup folder
            </button>
          </div>

          {bMsg && (
            <p className={bMsg.ok ? 'break-all text-sm text-green-700' : 'text-sm text-red-600'}>
              {bMsg.text}
            </p>
          )}

          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Automatic backups</div>
            {backups?.folder && <div className="mb-2 break-all text-xs text-slate-400">{backups.folder}</div>}
            <div className="max-h-56 overflow-y-auto border border-slate-200">
              <table className="w-full text-sm">
                <tbody>
                  {backups?.files.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-center text-slate-400">No backups yet</td>
                    </tr>
                  )}
                  {backups?.files.map((f) => (
                    <tr key={f.name} className="border-b border-slate-100">
                      <td className="px-3 py-1.5">{f.name}</td>
                      <td className="px-3 py-1.5 text-slate-500">
                        {new Date(f.modifiedAt).toLocaleString('en-GB')}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-500">{fmtSize(f.sizeBytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}