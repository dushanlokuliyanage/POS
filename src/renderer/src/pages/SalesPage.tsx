import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Printer, X } from 'lucide-react'
import { formatMoney } from '../lib/format'
import { cn } from '../lib/utils'
import { useAuth } from '../stores/auth.store'

const today = (): string => new Date().toLocaleDateString('en-CA')
const fmtDate = (ms: number): string => new Date(ms).toLocaleString('en-GB')

function SaleDetailModal({ id, onClose }: { id: number; onClose: () => void }): React.JSX.Element {
  const qc = useQueryClient()
  const role = useAuth((s) => s.user?.role)
  const [msg, setMsg] = useState<string | null>(null)
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['sale', id],
    queryFn: async () => {
      const res = await window.api.sales.get(id)
      if (!res.ok) throw new Error(res.error)
      return res.data
    }
  })

  const canVoid = data?.status === 'completed' && (role === 'admin' || role === 'manager')

  const print = async (): Promise<void> => {
    setMsg(null)
    const res = await window.api.sales.print(id)
    if (!res.ok) setMsg(res.error)
  }

  const doVoid = async (): Promise<void> => {
    setMsg(null)
    if (!reason.trim()) return setMsg('Enter a reason')
    setBusy(true)
    const res = await window.api.sales.void(id, reason)
    setBusy(false)
    if (!res.ok) return setMsg(res.error)
    setVoiding(false)
    setReason('')
    for (const key of ['sale', 'sales', 'products', 'admin-products', 'dashboard', 'current-shift', 'shifts']) {
      qc.invalidateQueries({ queryKey: [key] })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-[30rem] overflow-y-auto border border-slate-300 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {data?.receiptNo ?? 'Sale'}
              {data && data.status !== 'completed' && (
                <span className="ml-2 bg-red-100 px-2 py-0.5 text-xs font-medium uppercase text-red-800">
                  {data.status}
                </span>
              )}
            </h2>
            {data && (
              <p className="text-sm text-slate-500">
                {fmtDate(data.createdAt)} · {data.cashier}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>

        {isLoading && <p className="text-slate-500">Loading...</p>}

        {data && (
          <div className="space-y-4 text-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-1 font-medium">Item</th>
                  <th className="py-1 text-right font-medium">Qty</th>
                  <th className="py-1 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((i, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-1.5">{i.name}</td>
                    <td className="py-1.5 text-right">{i.qty}</td>
                    <td className="py-1.5 text-right">{formatMoney(i.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal</span>
                <span>{formatMoney(data.subtotalCents)}</span>
              </div>
              {data.discountCents > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Discount</span>
                  <span>-{formatMoney(data.discountCents)}</span>
                </div>
              )}
              {data.taxCents > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Tax</span>
                  <span>{formatMoney(data.taxCents)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-bold">
                <span>Total</span>
                <span>{formatMoney(data.totalCents)}</span>
              </div>
            </div>

            <div className="border border-slate-200 bg-slate-50 p-3">
              {data.payments.map((p, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="capitalize text-slate-600">{p.method}</span>
                  <span>{formatMoney(p.amountCents)}</span>
                </div>
              ))}
            </div>

            {msg && <p className="text-red-600">{msg}</p>}

            <button
              onClick={print}
              className="flex w-full items-center justify-center gap-2 bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700"
            >
              <Printer size={16} /> Print receipt
            </button>

            {canVoid && !voiding && (
              <button
                onClick={() => setVoiding(true)}
                className="w-full border border-red-600 py-2.5 font-medium text-red-600 hover:bg-red-50"
              >
                Void this sale
              </button>
            )}

            {canVoid && voiding && (
              <div className="space-y-2 border border-red-300 bg-red-50 p-3">
                <p className="text-xs text-red-800">
                  This cancels the sale and puts the items back in stock. Give the cash back to the
                  customer. Only possible while the sale&apos;s shift is still open.
                </p>
                <input
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason (e.g. Wrong item scanned)"
                  className="w-full border border-slate-300 bg-white px-3 py-2 outline-none focus:border-red-500"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setVoiding(false)
                      setMsg(null)
                    }}
                    className="border border-slate-300 bg-white py-2 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={doVoid}
                    disabled={busy}
                    className="bg-red-600 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {busy ? 'Voiding...' : 'Confirm void'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SalesPage(): React.JSX.Element {
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())
  const [selected, setSelected] = useState<number | null>(null)

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['sales', from, to],
    queryFn: async () => {
      const res = await window.api.sales.list({ from, to })
      if (!res.ok) throw new Error(res.error)
      return res.data
    }
  })

  const done = rows.filter((r) => r.status === 'completed')
  const revenue = done.reduce((s, r) => s + r.totalCents, 0)

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-slate-800">Sales history</h1>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm text-slate-600">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
          />
        </div>
        <button
          onClick={() => {
            setFrom(today())
            setTo(today())
          }}
          className="border border-slate-300 bg-white px-4 py-2 hover:bg-slate-100"
        >
          Today
        </button>

        <div className="ml-auto flex gap-3">
          <div className="border border-slate-200 bg-white px-4 py-2">
            <div className="text-xs text-slate-500">Sales</div>
            <div className="text-lg font-bold">{done.length}</div>
          </div>
          <div className="border border-slate-200 bg-white px-4 py-2">
            <div className="text-xs text-slate-500">Revenue</div>
            <div className="text-lg font-bold text-blue-700">{formatMoney(revenue)}</div>
          </div>
        </div>
      </div>

      {isLoading && <p className="text-slate-500">Loading...</p>}
      {error && <p className="text-red-600">{(error as Error).message}</p>}

      <div className="border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
              <th className="px-4 py-2 font-medium">Receipt</th>
              <th className="px-4 py-2 font-medium">Date and time</th>
              <th className="px-4 py-2 font-medium">Cashier</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No sales in this period
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => setSelected(r.id)}
                className="cursor-pointer border-b border-slate-100 hover:bg-blue-50"
              >
                <td className="px-4 py-2 font-medium">{r.receiptNo}</td>
                <td className="px-4 py-2">{fmtDate(r.createdAt)}</td>
                <td className="px-4 py-2">{r.cashier}</td>
                <td className={cn('px-4 py-2 text-right', r.status !== 'completed' && 'text-slate-400 line-through')}>
                  {formatMoney(r.totalCents)}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={cn(
                      'px-2 py-0.5 text-xs capitalize',
                      r.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    )}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected !== null && <SaleDetailModal id={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}