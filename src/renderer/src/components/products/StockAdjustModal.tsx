import { useState } from 'react'
import type { ProductAdminDTO } from '../../../../shared/types'

interface Props {
  product: ProductAdminDTO
  onClose: () => void
  onSaved: () => void
}

export default function StockAdjustModal({ product, onClose, onSaved }: Props): React.JSX.Element {
  const [change, setChange] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const delta = parseInt(change) || 0
  const next = product.stockQty + delta

  const save = async (e: React.SyntheticEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    if (delta === 0) return setError('Enter a quantity (use - to remove stock)')
    if (!reason.trim()) return setError('Enter a reason')
    setBusy(true)
    const res = await window.api.products.adjust({
      productId: product.id,
      qtyChange: delta,
      reason
    })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form onSubmit={save} className="w-[24rem] space-y-4 border border-slate-300 bg-white p-6 shadow-xl">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Adjust stock</h2>
          <p className="text-sm text-slate-500">{product.name}</p>
        </div>

        <div className="flex justify-between border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-600">Current</span>
          <span className="font-bold">{product.stockQty}</span>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">Change (+ add, - remove)</span>
          <input
            type="number"
            autoFocus
            value={change}
            onChange={(e) => setChange(e.target.value)}
            placeholder="e.g. 24 or -3"
            className="w-full border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-slate-600">Reason</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. New delivery, Damaged, Stock count"
            className="w-full border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          />
        </label>

        <div className="flex justify-between border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-600">New stock</span>
          <span className={next < 0 ? 'font-bold text-red-600' : 'font-bold'}>{next}</span>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="border border-slate-300 py-2.5 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}