import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatMoney } from '../lib/format'
import { cn } from '../lib/utils'
import type { ShiftDTO } from '../../../shared/types'

const today = (): string => new Date().toLocaleDateString('en-CA')
const daysAgo = (n: number): string => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('en-CA')
}
const fmt = (ms: number): string => new Date(ms).toLocaleString('en-GB')
const toCents = (v: string): number => Math.round((parseFloat(v) || 0) * 100)
const inputCls = 'w-full border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500'

function Variance({ cents }: { cents: number | null }): React.JSX.Element {
  if (cents === null) return <span>-</span>
  return (
    <span
      className={cn(
        'font-semibold',
        cents === 0 ? 'text-green-700' : cents < 0 ? 'text-red-600' : 'text-amber-600'
      )}
    >
      {cents > 0 ? '+' : ''}
      {formatMoney(cents)}
    </span>
  )
}

function Tile({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <div className="border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-bold text-slate-800">{value}</div>
    </div>
  )
}

export default function ShiftsPage(): React.JSX.Element {
  const qc = useQueryClient()
  const [opening, setOpening] = useState('')
  const [counted, setCounted] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastClosed, setLastClosed] = useState<ShiftDTO | null>(null)
  const [from, setFrom] = useState(daysAgo(7))
  const [to, setTo] = useState(today())

  const { data: current, isLoading } = useQuery({
    queryKey: ['current-shift'],
    queryFn: async () => {
      const res = await window.api.shifts.current()
      if (!res.ok) throw new Error(res.error)
      return res.data
    }
  })

  const { data: history = [] } = useQuery({
    queryKey: ['shifts', from, to],
    queryFn: async () => {
      const res = await window.api.shifts.list({ from, to })
      if (!res.ok) throw new Error(res.error)
      return res.data
    }
  })

  const refresh = (): void => {
    qc.invalidateQueries({ queryKey: ['current-shift'] })
    qc.invalidateQueries({ queryKey: ['shifts'] })
  }

  const openShift = async (): Promise<void> => {
    setError(null)
    const res = await window.api.shifts.open(toCents(opening))
    if (!res.ok) return setError(res.error)
    setOpening('')
    setLastClosed(null)
    refresh()
  }

  const closeShift = async (): Promise<void> => {
    if (!confirmClose) {
      setConfirmClose(true)
      return
    }
    setConfirmClose(false)
    setError(null)
    const res = await window.api.shifts.close(toCents(counted))
    if (!res.ok) return setError(res.error)
    setCounted('')
    setLastClosed(res.data)
    refresh()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Shifts</h1>

      {/* Current shift */}
      <div className="max-w-3xl border border-slate-200 bg-white p-6">
        {isLoading && <p className="text-slate-500">Loading...</p>}

        {!isLoading && !current && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">No open shift</h2>
              <p className="text-sm text-slate-500">
                Count the cash in the drawer and enter it to start selling.
              </p>
            </div>

            {lastClosed && (
              <div className="border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="mb-2 font-bold text-slate-800">Last shift closed</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>Expected: {formatMoney(lastClosed.expectedCashCents)}</div>
                  <div>Counted: {formatMoney(lastClosed.closingCashCents ?? 0)}</div>
                  <div>
                    Variance: <Variance cents={lastClosed.varianceCents} />
                  </div>
                </div>
              </div>
            )}

            <label className="block max-w-xs">
              <span className="mb-1 block text-sm text-slate-600">Opening cash (Rs.)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && openShift()}
                className={inputCls}
                autoFocus
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={openShift}
              className="bg-green-600 px-6 py-2.5 font-medium text-white hover:bg-green-700"
            >
              Open shift
            </button>
          </div>
        )}

        {current && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Shift open</h2>
              <p className="text-sm text-slate-500">
                Since {fmt(current.openedAt)} · {current.cashier}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile label="Opening cash" value={formatMoney(current.openingCashCents)} />
              <Tile label="Sales" value={`${current.salesCount} (${formatMoney(current.salesTotalCents)})`} />
              <Tile label="Cash sales" value={formatMoney(current.cashSalesCents)} />
              <Tile label="Expected in drawer" value={formatMoney(current.expectedCashCents)} />
            </div>

            <div className="border-t border-slate-200 pt-4">
              <label className="block max-w-xs">
                <span className="mb-1 block text-sm text-slate-600">Counted cash in drawer (Rs.)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={counted}
                  onChange={(e) => {
                    setCounted(e.target.value)
                    setConfirmClose(false)
                  }}
                  className={inputCls}
                />
              </label>
              {counted !== '' && (
                <p className="mt-2 text-sm">
                  Variance: <Variance cents={toCents(counted) - current.expectedCashCents} />
                </p>
              )}
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
              <button
                onClick={closeShift}
                disabled={counted === ''}
                className={cn(
                  'mt-3 px-6 py-2.5 font-medium text-white disabled:opacity-40',
                  confirmClose ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                )}
              >
                {confirmClose ? 'Click again to confirm' : 'Close shift'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <div>
        <div className="mb-3 flex flex-wrap items-end gap-4">
          <h2 className="mr-4 text-lg font-bold text-slate-800">History</h2>
          <label>
            <span className="mb-1 block text-sm text-slate-600">From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500" />
          </label>
          <label>
            <span className="mb-1 block text-sm text-slate-600">To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500" />
          </label>
        </div>

        <div className="overflow-x-auto border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="px-4 py-2 font-medium">Cashier</th>
                <th className="px-4 py-2 font-medium">Opened</th>
                <th className="px-4 py-2 font-medium">Closed</th>
                <th className="px-4 py-2 text-right font-medium">Sales</th>
                <th className="px-4 py-2 text-right font-medium">Expected</th>
                <th className="px-4 py-2 text-right font-medium">Counted</th>
                <th className="px-4 py-2 text-right font-medium">Variance</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No shifts in this period
                  </td>
                </tr>
              )}
              {history.map((s) => (
                <tr key={s.id} className="border-b border-slate-100">
                  <td className="px-4 py-2 font-medium">{s.cashier}</td>
                  <td className="px-4 py-2">{fmt(s.openedAt)}</td>
                  <td className="px-4 py-2">{s.closedAt ? fmt(s.closedAt) : '-'}</td>
                  <td className="px-4 py-2 text-right">
                    {s.salesCount} · {formatMoney(s.salesTotalCents)}
                  </td>
                  <td className="px-4 py-2 text-right">{formatMoney(s.expectedCashCents)}</td>
                  <td className="px-4 py-2 text-right">
                    {s.closingCashCents === null ? '-' : formatMoney(s.closingCashCents)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Variance cents={s.varianceCents} />
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={cn(
                        'px-2 py-0.5 text-xs capitalize',
                        s.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'
                      )}
                    >
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}