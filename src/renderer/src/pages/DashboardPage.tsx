import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../stores/auth.store'
import { formatMoney } from '../lib/format'
import { cn } from '../lib/utils'

const short = (cents: number): string =>
  (cents / 100).toLocaleString('en-LK', { maximumFractionDigits: 0 })

function Tile({
  label,
  value,
  warn
}: {
  label: string
  value: React.ReactNode
  warn?: boolean
}): React.JSX.Element {
  return (
    <div className={cn('border bg-white px-5 py-4', warn ? 'border-amber-400' : 'border-slate-200')}>
      <div className="text-sm text-slate-500">{label}</div>
      <div className={cn('mt-1 text-2xl font-bold', warn ? 'text-amber-600' : 'text-slate-800')}>
        {value}
      </div>
    </div>
  )
}

export default function DashboardPage(): React.JSX.Element {
  const user = useAuth((s) => s.user)

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await window.api.dashboard.get()
      if (!res.ok) throw new Error(res.error)
      return res.data
    },
    refetchInterval: 30000
  })

  if (isLoading) return <p className="text-slate-500">Loading...</p>
  if (error || !data) return <p className="text-red-600">{(error as Error)?.message}</p>

  const max = Math.max(1, ...data.last7.map((d) => d.totalCents))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Welcome, {user?.name}.{' '}
          {data.scope === 'mine' ? 'Showing your own sales.' : 'Showing all sales.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Tile label="Sales today" value={data.salesCount} />
        <Tile label="Revenue today" value={formatMoney(data.revenueCents)} />
        <Tile label="Items sold today" value={data.itemsSold} />
        <Tile label="Low stock items" value={data.lowStockCount} warn={data.lowStockCount > 0} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* 7-day chart */}
        <div className="border border-slate-200 bg-white p-5 xl:col-span-2">
          <h2 className="mb-4 font-bold text-slate-800">Last 7 days</h2>
          <div className="flex items-end gap-3">
            {data.last7.map((d, i) => {
              const h = d.totalCents > 0 ? Math.max(3, Math.round((d.totalCents / max) * 130)) : 0
              const isToday = i === data.last7.length - 1
              return (
                <div key={i} className="flex flex-1 flex-col items-center justify-end">
                  <span className="mb-1 text-xs text-slate-500">
                    {d.totalCents > 0 ? short(d.totalCents) : ''}
                  </span>
                  <div
                    className={isToday ? 'w-full bg-blue-600' : 'w-full bg-blue-300'}
                    style={{ height: h }}
                  />
                  <div className="mt-1 h-px w-full bg-slate-300" />
                  <span className={cn('mt-1 text-xs', isToday ? 'font-bold text-slate-800' : 'text-slate-500')}>
                    {d.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top products */}
        <div className="border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-bold text-slate-800">Top products today</h2>
          {data.topProducts.length === 0 && <p className="text-sm text-slate-400">No sales yet today</p>}
          <div className="space-y-2">
            {data.topProducts.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="truncate pr-2 text-slate-700">
                  {i + 1}. {p.name}
                </span>
                <span className="whitespace-nowrap text-slate-500">
                  {p.qty} · {formatMoney(p.totalCents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Low stock */}
      {data.lowStock.length > 0 && (
        <div className="border border-amber-300 bg-white p-5">
          <h2 className="mb-3 font-bold text-slate-800">Low stock</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-1 font-medium">Product</th>
                <th className="py-1 text-right font-medium">In stock</th>
                <th className="py-1 text-right font-medium">Alert at</th>
              </tr>
            </thead>
            <tbody>
              {data.lowStock.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-1.5">{p.name}</td>
                  <td className={cn('py-1.5 text-right font-bold', p.stockQty === 0 ? 'text-red-600' : 'text-amber-600')}>
                    {p.stockQty}
                  </td>
                  <td className="py-1.5 text-right text-slate-500">{p.threshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.lowStockCount > data.lowStock.length && (
            <p className="mt-2 text-xs text-slate-500">
              and {data.lowStockCount - data.lowStock.length} more
            </p>
          )}
        </div>
      )}
    </div>
  )
}