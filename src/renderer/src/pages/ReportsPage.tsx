import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { formatMoney } from '../lib/format'
import { cn } from '../lib/utils'
import type { ReportKind } from '../../../shared/types'

const ymd = (d: Date): string => d.toLocaleDateString('en-CA')
const daysAgo = (n: number): string => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return ymd(d)
}
const monthStart = (): string => {
  const d = new Date()
  d.setDate(1)
  return ymd(d)
}

function Tile({
  label,
  value,
  tone
}: {
  label: string
  value: React.ReactNode
  tone?: 'good' | 'warn'
}): React.JSX.Element {
  return (
    <div className="border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={cn(
          'mt-1 text-xl font-bold',
          tone === 'good' && 'text-green-700',
          tone === 'warn' && 'text-amber-600',
          !tone && 'text-slate-800'
        )}
      >
        {value}
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-bold text-slate-800">{title}</h2>
      {children}
    </div>
  )
}

const th = 'py-1 font-medium'

export default function ReportsPage(): React.JSX.Element {
  const [from, setFrom] = useState(daysAgo(6))
  const [to, setTo] = useState(ymd(new Date()))
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['report', from, to],
    queryFn: async () => {
      const res = await window.api.reports.get({ from, to })
      if (!res.ok) throw new Error(res.error)
      return res.data
    }
  })

  const exportCsv = async (kind: ReportKind): Promise<void> => {
    setMsg(null)
    const res = await window.api.reports.exportCsv({ from, to }, kind)
    if (!res.ok) return setMsg({ ok: false, text: res.error })
    if (res.data) setMsg({ ok: true, text: `Saved: ${res.data}` })
  }

  const preset = (f: string, t: string): void => {
    setFrom(f)
    setTo(t)
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-800">Reports</h1>

      <div className="flex flex-wrap items-end gap-3">
        <label>
          <span className="mb-1 block text-sm text-slate-600">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500" />
        </label>
        <label>
          <span className="mb-1 block text-sm text-slate-600">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500" />
        </label>
        <button onClick={() => preset(ymd(new Date()), ymd(new Date()))} className="border border-slate-300 bg-white px-3 py-2 hover:bg-slate-100">
          Today
        </button>
        <button onClick={() => preset(daysAgo(6), ymd(new Date()))} className="border border-slate-300 bg-white px-3 py-2 hover:bg-slate-100">
          Last 7 days
        </button>
        <button onClick={() => preset(monthStart(), ymd(new Date()))} className="border border-slate-300 bg-white px-3 py-2 hover:bg-slate-100">
          This month
        </button>

        <div className="ml-auto flex flex-wrap gap-2">
          {(['sales', 'products', 'daily'] as const).map((k) => (
            <button
              key={k}
              onClick={() => exportCsv(k)}
              className="flex items-center gap-2 border border-blue-600 px-3 py-2 text-sm font-medium capitalize text-blue-700 hover:bg-blue-50"
            >
              <Download size={14} /> {k} CSV
            </button>
          ))}
        </div>
      </div>

      {msg && <p className={cn('break-all text-sm', msg.ok ? 'text-green-700' : 'text-red-600')}>{msg.text}</p>}
      {isLoading && <p className="text-slate-500">Loading...</p>}
      {error && <p className="text-red-600">{(error as Error).message}</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Tile label="Sales" value={data.salesCount} />
            <Tile label="Revenue (incl. tax)" value={formatMoney(data.revenueCents)} />
            <Tile label="Tax collected" value={formatMoney(data.taxCents)} />
            <Tile label="Discounts given" value={formatMoney(data.discountCents)} />
            <Tile label="Cost of goods" value={formatMoney(data.costCents)} />
            <Tile label="Estimated profit" value={formatMoney(data.profitCents)} tone={data.profitCents >= 0 ? 'good' : 'warn'} />
            <Tile label="Voided sales" value={data.voidedCount} tone={data.voidedCount > 0 ? 'warn' : undefined} />
            <Tile label="Voided amount" value={formatMoney(data.voidedCents)} />
          </div>
          <p className="text-xs text-slate-500">
            Profit = revenue - tax - cost. Cost uses each product&apos;s current cost price. Product
            profit below is before discounts.
          </p>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Daily sales">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className={th}>Date</th>
                    <th className={cn(th, 'text-right')}>Sales</th>
                    <th className={cn(th, 'text-right')}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.length === 0 && (
                    <tr><td colSpan={3} className="py-4 text-center text-slate-400">No sales</td></tr>
                  )}
                  {data.daily.map((d) => (
                    <tr key={d.day} className="border-b border-slate-100">
                      <td className="py-1.5">{d.day}</td>
                      <td className="py-1.5 text-right">{d.count}</td>
                      <td className="py-1.5 text-right">{formatMoney(d.revenueCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <div className="space-y-4">
              <Card title="By cashier">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className={th}>Cashier</th>
                      <th className={cn(th, 'text-right')}>Sales</th>
                      <th className={cn(th, 'text-right')}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cashiers.length === 0 && (
                      <tr><td colSpan={3} className="py-4 text-center text-slate-400">No sales</td></tr>
                    )}
                    {data.cashiers.map((c) => (
                      <tr key={c.name} className="border-b border-slate-100">
                        <td className="py-1.5">{c.name}</td>
                        <td className="py-1.5 text-right">{c.count}</td>
                        <td className="py-1.5 text-right">{formatMoney(c.revenueCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <Card title="Payment methods">
                {data.payments.length === 0 && <p className="text-sm text-slate-400">No payments</p>}
                {data.payments.map((p) => (
                  <div key={p.method} className="flex justify-between border-b border-slate-100 py-1.5 text-sm">
                    <span className="capitalize">{p.method}</span>
                    <span>{formatMoney(p.amountCents)}</span>
                  </div>
                ))}
              </Card>
            </div>
          </div>

          <Card title="Products">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className={th}>Product</th>
                  <th className={cn(th, 'text-right')}>Qty sold</th>
                  <th className={cn(th, 'text-right')}>Revenue (excl. tax)</th>
                  <th className={cn(th, 'text-right')}>Profit</th>
                </tr>
              </thead>
              <tbody>
                {data.products.length === 0 && (
                  <tr><td colSpan={4} className="py-4 text-center text-slate-400">No sales</td></tr>
                )}
                {data.products.map((p) => (
                  <tr key={p.name} className="border-b border-slate-100">
                    <td className="py-1.5">{p.name}</td>
                    <td className="py-1.5 text-right">{p.qty}</td>
                    <td className="py-1.5 text-right">{formatMoney(p.revenueCents)}</td>
                    <td className={cn('py-1.5 text-right', p.profitCents < 0 && 'text-red-600')}>
                      {formatMoney(p.profitCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  )
}