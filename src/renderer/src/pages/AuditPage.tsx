import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatMoney } from '../lib/format'

const formatTime = (ms: number): string => new Date(ms).toLocaleString('en-GB')

function detailsText(value: string | null): string {
  if (!value) return '—'
  try {
    const parsed = JSON.parse(value) as unknown
    if (typeof parsed === 'object' && parsed !== null && 'totalCents' in parsed) {
      const details = parsed as { totalCents?: number; reason?: string; qtyChange?: number; name?: string }
      return [details.name, details.qtyChange != null ? `Qty ${details.qtyChange > 0 ? '+' : ''}${details.qtyChange}` : null,
        details.totalCents != null ? formatMoney(details.totalCents) : null, details.reason].filter(Boolean).join(' · ') || value
    }
    return JSON.stringify(parsed)
  } catch {
    return value
  }
}

export default function AuditPage(): React.JSX.Element {
  const qc = useQueryClient()
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const res = await window.api.audit.list()
      if (!res.ok) throw new Error(res.error)
      return res.data
    }
  })

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Audit history</h1>
          <p className="text-sm text-slate-500">Latest 500 recorded changes and sensitive actions.</p>
        </div>
        <button onClick={() => void qc.invalidateQueries({ queryKey: ['audit-logs'] })} className="border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">Refresh</button>
      </div>
      {isLoading && <p className="text-slate-500">Loading audit history...</p>}
      {error && <p className="text-red-600">{(error as Error).message}</p>}
      <div className="overflow-x-auto border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
              <th className="px-4 py-2 font-medium">Time</th>
              <th className="px-4 py-2 font-medium">Staff member</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Record</th>
              <th className="px-4 py-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && !isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No recorded actions yet</td></tr>}
            {data.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 align-top">
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">{formatTime(row.createdAt)}</td>
                <td className="px-4 py-2">{row.userName}</td>
                <td className="px-4 py-2 font-medium">{row.action}</td>
                <td className="px-4 py-2 text-slate-600">{row.entity ?? '—'}{row.entityId ? ` #${row.entityId}` : ''}</td>
                <td className="max-w-xl break-words px-4 py-2 text-slate-600">{detailsText(row.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
