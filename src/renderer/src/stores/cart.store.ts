import { create } from 'zustand'
import type { ProductDTO } from '../../../shared/types'

export interface CartLine {
  product: ProductDTO
  qty: number
}

interface CartState {
  lines: CartLine[]
  discountCents: number
  add: (p: ProductDTO) => void
  setQty: (id: number, qty: number) => void
  remove: (id: number) => void
  setDiscount: (cents: number) => void
  clear: () => void
}

export const useCart = create<CartState>((set) => ({
  lines: [],
  discountCents: 0,

  add: (p) =>
    set((s) => {
      const existing = s.lines.find((l) => l.product.id === p.id)
      const nextQty = (existing?.qty ?? 0) + 1
      if (p.trackStock && nextQty > p.stockQty) return s // not enough stock
      if (existing) {
        return {
          lines: s.lines.map((l) => (l.product.id === p.id ? { ...l, qty: nextQty } : l))
        }
      }
      return { lines: [...s.lines, { product: p, qty: 1 }] }
    }),

  setQty: (id, qty) =>
    set((s) => ({
      lines: s.lines.map((l) => {
        if (l.product.id !== id) return l
        const max = l.product.trackStock ? l.product.stockQty : 9999
        return { ...l, qty: Math.max(1, Math.min(qty, max)) }
      })
    })),

  remove: (id) => set((s) => ({ lines: s.lines.filter((l) => l.product.id !== id) })),
  setDiscount: (cents) => set({ discountCents: Math.max(0, cents) }),
  clear: () => set({ lines: [], discountCents: 0 })
}))

// Same math as the server, for display only
export function calcTotals(lines: CartLine[], discountCents: number) {
  let subtotal = 0
  let tax = 0
  for (const l of lines) {
    const sub = l.product.priceCents * l.qty
    subtotal += sub
    tax += Math.round((sub * l.product.taxBps) / 10000)
  }
  const discount = Math.min(discountCents, subtotal)
  return { subtotal, tax, discount, total: subtotal - discount + tax }
}