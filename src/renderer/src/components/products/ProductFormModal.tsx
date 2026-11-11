import { useState } from 'react'
import type { CategoryDTO, ProductAdminDTO, ProductInput } from '../../../../shared/types'

interface Props {
  product: ProductAdminDTO | null // null = new product
  categories: CategoryDTO[]
  onClose: () => void
  onSaved: () => void
}

const toCents = (v: string): number => Math.round((parseFloat(v) || 0) * 100)
const fromCents = (c: number): string => (c / 100).toFixed(2)
const inputCls =
  'w-full border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500'

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-slate-600">{label}</span>
      {children}
    </label>
  )
}

export default function ProductFormModal({
  product,
  categories,
  onClose,
  onSaved
}: Props): React.JSX.Element {
  const [name, setName] = useState(product?.name ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [barcode, setBarcode] = useState(product?.barcode ?? '')
  const [categoryId, setCategoryId] = useState(product?.categoryId?.toString() ?? '')
  const [price, setPrice] = useState(product ? fromCents(product.priceCents) : '')
  const [cost, setCost] = useState(product ? fromCents(product.costCents) : '')
  const [tax, setTax] = useState(product ? String(product.taxBps / 100) : '0')
  const [opening, setOpening] = useState('0')
  const [low, setLow] = useState(String(product?.lowStockThreshold ?? 5))
  const [track, setTrack] = useState(product?.trackStock ?? true)
  const [active, setActive] = useState(product?.isActive ?? true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async (e: React.SyntheticEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    if (!name.trim() || !sku.trim()) {
      setError('Name and SKU are required')
      return
    }
    const input: ProductInput = {
      sku,
      barcode: barcode.trim() ? barcode : null,
      name,
      categoryId: categoryId ? Number(categoryId) : null,
      priceCents: toCents(price),
      costCents: toCents(cost),
      taxBps: Math.round((parseFloat(tax) || 0) * 100),
      lowStockThreshold: Math.max(0, parseInt(low) || 0),
      trackStock: track,
      isActive: active,
      openingStock: Math.max(0, parseInt(opening) || 0)
    }
    setBusy(true)
    const res = product
      ? await window.api.products.update(product.id, input)
      : await window.api.products.create(input)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form
        onSubmit={save}
        className="max-h-[92vh] w-[36rem] overflow-y-auto border border-slate-300 bg-white p-6 shadow-xl"
      >
        <h2 className="mb-4 text-lg font-bold text-slate-800">
          {product ? 'Edit product' : 'Add product'}
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Name">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>
          </div>
          <Field label="SKU">
            <input className={inputCls} value={sku} onChange={(e) => setSku(e.target.value)} />
          </Field>
          <Field label="Barcode (optional)">
            <input className={inputCls} value={barcode} onChange={(e) => setBarcode(e.target.value)} />
          </Field>
          <Field label="Category">
            <select className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tax %">
            <input type="number" min="0" max="100" step="0.01" className={inputCls} value={tax} onChange={(e) => setTax(e.target.value)} />
          </Field>
          <Field label="Selling price (Rs.)">
            <input type="number" min="0" step="0.01" className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field label="Cost price (Rs.)">
            <input type="number" min="0" step="0.01" className={inputCls} value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
          {!product && (
            <Field label="Opening stock">
              <input type="number" min="0" className={inputCls} value={opening} onChange={(e) => setOpening(e.target.value)} />
            </Field>
          )}
          <Field label="Low stock alert at">
            <input type="number" min="0" className={inputCls} value={low} onChange={(e) => setLow(e.target.value)} />
          </Field>
          <div className="col-span-2 flex gap-6 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={track} onChange={(e) => setTrack(e.target.checked)} />
              Track stock
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Active (visible at checkout)
            </label>
          </div>
        </div>

        {product && (
          <p className="mt-3 text-xs text-slate-500">
            To change the stock quantity, use the Stock button on the products list.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 grid grid-cols-2 gap-2">
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