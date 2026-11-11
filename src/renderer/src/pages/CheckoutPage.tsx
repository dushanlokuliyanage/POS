import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Minus, Plus, Search, Trash2, UserRoundPlus, X } from 'lucide-react'
import { formatMoney } from '../lib/format'
import { cn } from '../lib/utils'
import { calcTotals, useCart } from '../stores/cart.store'
import PaymentModal from '../components/checkout/PaymentModal'
import type { CustomerDTO } from '../../../shared/types'

export default function CheckoutPage(): React.JSX.Element {
  const qc = useQueryClient()
  const { lines, discountCents, add, setQty, remove, setDiscount, clear } = useCart()
  const [search, setSearch] = useState('')
  const [discountText, setDiscountText] = useState('')
  const [paying, setPaying] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(0)
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDTO | null>(null)
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerError, setCustomerError] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn: async () => {
      const res = await window.api.products.list(search)
      if (!res.ok) throw new Error(res.error)
      return res.data
    },
    placeholderData: (prev) => prev
  })

  const totals = calcTotals(lines, discountCents)
  const { data: customers = [] } = useQuery({
    queryKey: ['customers', customerSearch],
    queryFn: async () => {
      const res = await window.api.customers.list(customerSearch)
      if (!res.ok) throw new Error(res.error)
      return res.data
    }
  })
  const saveCustomer = async (): Promise<void> => {
    const name = customerName.trim()
    if (!name) return setCustomerError('Enter the customer name')
    setCustomerError(null)
    const res = await window.api.customers.create(name, customerPhone.trim() || null)
    if (!res.ok) return setCustomerError(res.error)
    setSelectedCustomer(res.data)
    setCustomerSearch('')
    setCustomerName('')
    setCustomerPhone('')
    setShowCustomerForm(false)
    qc.invalidateQueries({ queryKey: ['customers'] })
  }

  // Clear discount box after a sale / clear
  useEffect(() => {
    if (lines.length === 0) {
      setDiscountText('')
      setSelectedCustomer(null)
    }
  }, [lines.length])

  // Checkout keys: F2 search, F4 price lookup, F9 payment, F10 clear cart.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      if (e.key === 'F2') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'F4') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
      if (e.key === 'F9' && lines.length > 0 && !paying) {
        e.preventDefault()
        setPaying(true)
      }
      if (e.key === 'F10' && lines.length > 0 && !typing && !paying) {
        e.preventDefault()
        clear()
      }
      if (!typing && !paying && products.length > 0 && ['ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault()
        setSelectedProduct((current) => (current + (e.key === 'ArrowDown' ? 1 : products.length - 1)) % products.length)
      }
      if (!typing && !paying && e.key === 'Enter' && products[selectedProduct]) {
        e.preventDefault()
        add(products[selectedProduct])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lines.length, paying, products, selectedProduct, add, clear])

  useEffect(() => setSelectedProduct(0), [search])

  // Enter in search box: barcode scan, or add the only match
  const onSearchEnter = async (): Promise<void> => {
    const code = search.trim()
    if (!code) return
    const res = await window.api.products.byBarcode(code)
    if (res.ok && res.data) {
      add(res.data)
      setSearch('')
    } else if (products.length === 1) {
      add(products[0])
      setSearch('')
    }
  }

  const closePayment = (): void => {
    setPaying(false)
    searchRef.current?.focus()
  }

  return (
    <div className="flex h-full min-h-0 gap-4">
      {/* LEFT: products */}
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3 top-3 text-slate-400" />
          <input
            ref={searchRef}
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearchEnter()}
            placeholder="Scan barcode or search product (F2)"
            className="w-full border border-slate-300 bg-white py-2.5 pl-10 pr-3 outline-none focus:border-blue-500"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading && <p className="text-slate-500">Loading...</p>}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
            {products.map((p) => {
              const out = p.trackStock && p.stockQty <= 0
              return (
                <button
                  key={p.id}
                  disabled={out}
                  onClick={() => add(p)}
                  className={cn(
                    'border border-slate-200 bg-white p-4 text-left shadow-sm',
                    out ? 'opacity-40' : selectedProduct === products.indexOf(p) ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'hover:border-blue-500 hover:bg-blue-50'
                  )}
                >
                  <div className="font-medium text-slate-800">{p.name}</div>
                  <div className="mt-1 font-semibold text-blue-700">
                    {formatMoney(p.priceCents)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {out ? 'Out of stock' : p.trackStock ? `Stock: ${p.stockQty}` : 'In stock'}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* RIGHT: cart */}
      <aside className="flex min-h-0 w-96 flex-col border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-bold text-slate-800">Current sale</h2>
          {lines.length > 0 && (
            <button onClick={clear} className="text-sm text-red-600 hover:underline">
              Clear
            </button>
          )}
        </div>

        <div className="space-y-2 border-b border-slate-200 p-3">
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-blue-50 px-3 py-2 text-sm">
              <span className="truncate font-medium text-slate-800">
                Customer: {selectedCustomer.name}{selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ''}
              </span>
              <button aria-label="Remove customer from sale" onClick={() => setSelectedCustomer(null)} className="ml-2 text-slate-500 hover:text-red-600">
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <input
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Find customer by name or phone (optional)"
                className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              {customerSearch.trim() && customers.length > 0 && (
                <div className="max-h-28 overflow-y-auto border border-slate-200">
                  {customers.map((customer) => (
                    <button key={customer.id} onClick={() => { setSelectedCustomer(customer); setCustomerSearch('') }} className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-blue-50">
                      {customer.name}{customer.phone ? <span className="ml-2 text-slate-500">{customer.phone}</span> : null}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => { setCustomerName(customerSearch); setShowCustomerForm((open) => !open); setCustomerError(null) }} className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">
                <UserRoundPlus size={14} /> Add new customer
              </button>
              {showCustomerForm && (
                <div className="space-y-2 border border-slate-200 bg-slate-50 p-2">
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" className="w-full border border-slate-300 px-2 py-1.5 text-sm" />
                  <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone (optional)" className="w-full border border-slate-300 px-2 py-1.5 text-sm" />
                  {customerError && <p className="text-xs text-red-600">{customerError}</p>}
                  <button onClick={() => void saveCustomer()} className="w-full bg-blue-600 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Save and attach</button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {lines.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-400">Cart is empty</p>
          )}
          {lines.map((l) => (
            <div key={l.product.id} className="border-b border-slate-100 px-4 py-3">
              <div className="flex justify-between gap-2">
                <span className="text-sm font-medium text-slate-800">{l.product.name}</span>
                <button onClick={() => remove(l.product.id)} className="text-slate-400 hover:text-red-600">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center">
                  <button
                    onClick={() => setQty(l.product.id, l.qty - 1)}
                    className="border border-slate-300 p-1.5 hover:bg-slate-100"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-10 text-center text-sm">{l.qty}</span>
                  <button
                    onClick={() => setQty(l.product.id, l.qty + 1)}
                    className="border border-slate-300 p-1.5 hover:bg-slate-100"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <span className="text-sm font-semibold">
                  {formatMoney(l.product.priceCents * l.qty)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t border-slate-200 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Subtotal</span>
            <span>{formatMoney(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Discount (Rs.)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={discountText}
              onChange={(e) => {
                setDiscountText(e.target.value)
                setDiscount(Math.round((parseFloat(e.target.value) || 0) * 100))
              }}
              className="w-28 border border-slate-300 px-2 py-1 text-right outline-none focus:border-blue-500"
            />
          </div>
          {totals.tax > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-600">Tax</span>
              <span>{formatMoney(totals.tax)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold">
            <span>Total</span>
            <span>{formatMoney(totals.total)}</span>
          </div>
          <button
            disabled={lines.length === 0}
            onClick={() => setPaying(true)}
            className="w-full bg-green-600 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-40"
          >
            Pay (F9)
          </button>
          <p className="text-center text-xs text-slate-500">F2 Search · F4 Price lookup · ↑/↓ select · Enter add · F9 pay · F10 clear</p>
        </div>
      </aside>

      {paying && <PaymentModal totalCents={totals.total} customerId={selectedCustomer?.id ?? null} onClose={closePayment} />}
    </div>
  )
}
