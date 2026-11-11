import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PackagePlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { formatMoney } from '../lib/format'
import { cn } from '../lib/utils'
import type { ProductAdminDTO } from '../../../shared/types'
import ProductFormModal from '../components/products/ProductFormModal'
import StockAdjustModal from '../components/products/StockAdjustModal'

export default function ProductsPage(): React.JSX.Element {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<ProductAdminDTO | 'new' | null>(null)
  const [adjusting, setAdjusting] = useState<ProductAdminDTO | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [newCat, setNewCat] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin-products', search],
    queryFn: async () => {
      const res = await window.api.products.listAdmin(search)
      if (!res.ok) throw new Error(res.error)
      return res.data
    },
    placeholderData: (prev) => prev
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await window.api.categories.list()
      if (!res.ok) throw new Error(res.error)
      return res.data
    }
  })

  const refresh = (): void => {
    qc.invalidateQueries({ queryKey: ['admin-products'] })
    qc.invalidateQueries({ queryKey: ['products'] }) // checkout list
  }

  const remove = async (p: ProductAdminDTO): Promise<void> => {
    if (confirmId !== p.id) {
      setConfirmId(p.id)
      return
    }
    setConfirmId(null)
    const res = await window.api.products.remove(p.id)
    if (!res.ok) setMsg(res.error)
    else refresh()
  }

  const addCategory = async (): Promise<void> => {
    if (!newCat.trim()) return
    setMsg(null)
    const res = await window.api.categories.create(newCat)
    if (!res.ok) return setMsg(res.error)
    setNewCat('')
    qc.invalidateQueries({ queryKey: ['categories'] })
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Products</h1>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-2 bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} /> Add product
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, SKU or barcode"
          className="w-80 border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
        />
        <div className="ml-auto flex items-center gap-2">
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            placeholder="New category"
            className="w-44 border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
          />
          <button onClick={addCategory} className="border border-slate-300 bg-white px-3 py-2 hover:bg-slate-100">
            Add category
          </button>
        </div>
      </div>

      {msg && <p className="mb-3 text-sm text-red-600">{msg}</p>}
      {isLoading && <p className="text-slate-500">Loading...</p>}

      <div className="border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">SKU</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 text-right font-medium">Price</th>
              <th className="px-4 py-2 text-right font-medium">Cost</th>
              <th className="px-4 py-2 text-right font-medium">Stock</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No products found
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const low = p.trackStock && p.stockQty <= p.lowStockThreshold
              return (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-2 text-slate-600">{p.sku}</td>
                  <td className="px-4 py-2 text-slate-600">{p.categoryName ?? '-'}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(p.priceCents)}</td>
                  <td className="px-4 py-2 text-right text-slate-500">{formatMoney(p.costCents)}</td>
                  <td className={cn('px-4 py-2 text-right', low && 'font-bold text-amber-600')}>
                    {p.trackStock ? p.stockQty : '-'}
                    {low && <span className="ml-1 text-xs">LOW</span>}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={cn(
                        'px-2 py-0.5 text-xs',
                        p.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'
                      )}
                    >
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <button
                        title="Edit"
                        onClick={() => setEditing(p)}
                        className="border border-slate-300 p-1.5 hover:bg-slate-100"
                      >
                        <Pencil size={14} />
                      </button>
                      {p.trackStock && (
                        <button
                          title="Adjust stock"
                          onClick={() => setAdjusting(p)}
                          className="border border-slate-300 p-1.5 hover:bg-slate-100"
                        >
                          <PackagePlus size={14} />
                        </button>
                      )}
                      <button
                        title="Delete"
                        onClick={() => remove(p)}
                        onBlur={() => setConfirmId(null)}
                        className={cn(
                          'border p-1.5',
                          confirmId === p.id
                            ? 'border-red-600 bg-red-600 text-white'
                            : 'border-slate-300 text-red-600 hover:bg-red-50'
                        )}
                      >
                        {confirmId === p.id ? <span className="px-1 text-xs">Sure?</span> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <ProductFormModal
          product={editing === 'new' ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
      {adjusting && (
        <StockAdjustModal
          product={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            setAdjusting(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}