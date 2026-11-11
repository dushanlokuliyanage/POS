import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCart } from '../../stores/cart.store'
import { formatMoney } from '../../lib/format'
import { cn } from '../../lib/utils'
import type { SaleResult } from '../../../../shared/types'

interface Props {
  totalCents: number
  customerId: number | null
  onClose: () => void
}

export default function PaymentModal({ totalCents, customerId, onClose }: Props): React.JSX.Element {
  const { lines, discountCents, clear } = useCart()
  const qc = useQueryClient()
  const [method, setMethod] = useState<'cash' | 'card' | 'split'>('cash')
  const [tendered, setTendered] = useState('')
  const [cardAmount, setCardAmount] = useState('')
  const [cardApproved, setCardApproved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<SaleResult | null>(null)
  const printReceipt = (): void => {
    if (done) void window.api.sales.print(done.id)
  }

  const tenderedCents = Math.round((parseFloat(tendered) || 0) * 100)
  const cardCents = method === 'cash' ? 0 : method === 'card' ? totalCents : Math.round((parseFloat(cardAmount) || 0) * 100)
  const cashDueCents = Math.max(0, totalCents - cardCents)
  const paid = method === 'card' ? totalCents : method === 'split' ? tenderedCents + cardCents : tenderedCents
  const change = Math.max(0, paid - totalCents)
  const hasValidCardAmount = cardCents >= 0 && cardCents <= totalCents
  const canPay = paid >= totalCents && hasValidCardAmount && !busy && (cardCents === 0 || cardApproved)

  const setPaymentMethod = (next: 'cash' | 'card' | 'split'): void => {
    setMethod(next)
    setCardApproved(false)
    if (next === 'card') setCardAmount((totalCents / 100).toFixed(2))
    if (next === 'split') setCardAmount('')
  }

  const confirm = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const res = await window.api.sales.create({
      items: lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
      discountCents,
      customerId,
      payments: method === 'cash'
        ? [{ method: 'cash', amountCents: tenderedCents }]
        : method === 'card'
          ? [{ method: 'card', amountCents: totalCents }]
          : [
              ...(cardCents > 0 ? [{ method: 'card' as const, amountCents: cardCents }] : []),
              ...(tenderedCents > 0 ? [{ method: 'cash' as const, amountCents: tenderedCents }] : [])
            ]
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    clear()
    qc.invalidateQueries({ queryKey: ['products'] })
    setDone(res.data)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (done && (e.key === 'F8' || e.key === 'p' && e.ctrlKey)) {
        e.preventDefault()
        printReceipt()
        return
      }
      if (!done && e.key === 'Enter' && canPay) {
        e.preventDefault()
        void confirm()
        return
      }
      if (!done && ['F5', 'F6', 'F7'].includes(e.key)) {
        e.preventDefault()
        setPaymentMethod(e.key === 'F5' ? 'split' : e.key === 'F6' ? 'cash' : 'card')
      }
      if (!done && (method === 'cash' || method === 'split') && ['a', 'b', 'c', 'd'].includes(e.key.toLowerCase()) && !e.ctrlKey && !e.altKey) {
        const amounts: Record<string, number> = { a: 500, b: 1000, c: 2000, d: 5000 }
        e.preventDefault()
        setTendered(String(amounts[e.key.toLowerCase()]))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, done, canPay, method, totalCents])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[30rem] border border-slate-300 bg-white p-6 shadow-xl">
        {done ? (
          <div className="space-y-4 text-center">
            <div className="text-xl font-bold text-green-700">Sale completed</div>
            <div className="text-sm text-slate-600">Receipt {done.receiptNo}</div>
            <div className="border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Change to give</div>
              <div className="text-3xl font-bold text-slate-900">
                {formatMoney(done.changeCents)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={printReceipt}
                className="border border-slate-300 py-3 font-medium hover:bg-slate-100"
              >
                Print receipt (F8)
              </button>
              <button
                autoFocus
                onClick={onClose}
                className="bg-blue-600 py-3 font-medium text-white hover:bg-blue-700"
              >
                New sale (Esc)
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold text-slate-800">Payment</h2>
              <span className="text-2xl font-bold text-blue-700">{formatMoney(totalCents)}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(['cash', 'card', 'split'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={cn(
                    'border py-2 font-medium capitalize',
                    method === m
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-300 hover:bg-slate-100'
                  )}
                >
                  {m === 'cash' ? 'Cash (F6)' : m === 'card' ? 'Card (F7)' : 'Split (F5)'}
                </button>
              ))}
            </div>

            {(method === 'card' || method === 'split') && (
              <div className="space-y-3 border border-blue-200 bg-blue-50 p-4">
                <div className="text-sm font-semibold text-slate-800">Card payment · Cargirls Food City</div>
                {method === 'split' && (
                  <label className="block text-sm text-slate-700">
                    Card portion (Rs.)
                    <input
                      type="number"
                      min="0"
                      max={(totalCents / 100).toFixed(2)}
                      step="0.01"
                      value={cardAmount}
                      onChange={(e) => { setCardAmount(e.target.value); setCardApproved(false) }}
                      className="mt-1 w-full border border-slate-300 bg-white px-3 py-2 text-base"
                    />
                  </label>
                )}
                <p className="text-sm text-slate-700">
                  Charge <strong>{formatMoney(cardCents)}</strong> on the card machine. Complete the payment on the terminal first.
                </p>
                {cardCents > 0 && (
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={cardApproved} onChange={(e) => setCardApproved(e.target.checked)} className="mt-0.5" />
                    <span>The card machine approved this payment.</span>
                  </label>
                )}
                {!hasValidCardAmount && <p className="text-sm text-red-600">Card portion cannot exceed the sale total.</p>}
              </div>
            )}

            {(method === 'cash' || method === 'split') && (
              <div className="space-y-2">
                <label className="block text-sm text-slate-600">Cash received (Rs.){method === 'split' ? ` · ${formatMoney(cashDueCents)} due in cash` : ''}</label>
                <input
                  autoFocus
                  type="number"
                  min="0"
                  step="0.01"
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && canPay && confirm()}
                  className="w-full border border-slate-300 px-3 py-2 text-lg outline-none focus:border-blue-500"
                />
                <div className="grid grid-cols-5 gap-2">
                  <button
                    onClick={() => setTendered((cashDueCents / 100).toFixed(2))}
                    className="border border-slate-300 py-1 text-sm hover:bg-slate-100"
                  >
                    Exact
                  </button>
                  {[500, 1000, 2000, 5000].map((v, index) => (
                    <button
                      key={v}
                      onClick={() => setTendered(String(v))}
                      className="border border-slate-300 py-1 text-sm hover:bg-slate-100"
                    >
                      {v} ({String.fromCharCode(65 + index)})
                    </button>
                  ))}
                </div>
                <div className="flex justify-between border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="text-slate-600">Change</span>
                  <span className="font-bold">{formatMoney(change)}</span>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="grid grid-cols-2 gap-2">
              <button onClick={onClose} className="border border-slate-300 py-3 hover:bg-slate-100">
                Cancel
              </button>
              <button
                onClick={confirm}
                disabled={!canPay}
                className="bg-green-600 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-40"
              >
                {busy ? 'Saving...' : cardCents > 0 ? 'Record approved payment (Enter)' : 'Confirm (Enter)'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
