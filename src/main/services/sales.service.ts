import { eq, inArray, sql } from 'drizzle-orm'
import { getDb } from '../db'
import { auditLogs, customers, payments, products, saleItems, sales, stockMovements } from '../db/schema'
import { requireUser } from './auth.service'
import { getOpenShiftId } from './shifts.service'
import type { SaleInput, SaleResult } from '../../shared/types'

export function createSale(input: SaleInput): SaleResult {
  const user = requireUser()

  const shiftId = getOpenShiftId(user.id)
  if (!shiftId) throw new Error('Open a shift before selling (Shifts page)')

  return getDb().transaction((tx) => {
    // 1. Load products from DB (never trust prices from the screen)
    const ids = [...new Set(input.items.map((i) => i.productId))]
    const rows = tx.select().from(products).where(inArray(products.id, ids)).all()
    const byId = new Map(rows.map((r) => [r.id, r]))
    if (input.customerId != null) {
      const customer = tx.select({ id: customers.id }).from(customers)
        .where(eq(customers.id, input.customerId)).get()
      if (!customer) throw new Error('Selected customer is no longer available')
    }

    // 2. Calculate lines
    let subtotal = 0
    let tax = 0
    const lines = input.items.map((item) => {
      const p = byId.get(item.productId)
      if (!p || p.deletedAt || !p.isActive) throw new Error('A product is not available')
      if (p.trackStock && p.stockQty < item.qty) {
        throw new Error(`Not enough stock: ${p.name}`)
      }
      const lineSub = p.priceCents * item.qty
      const lineTax = Math.round((lineSub * p.taxBps) / 10000)
      subtotal += lineSub
      tax += lineTax
      return { p, qty: item.qty, lineSub, lineTax }
    })

    const discount = Math.min(input.discountCents, subtotal)
    const total = subtotal - discount + tax

    // 3. Check payment
    const paid = input.payments.reduce((s, x) => s + x.amountCents, 0)
    const cashPaid = input.payments
      .filter((x) => x.method === 'cash')
      .reduce((s, x) => s + x.amountCents, 0)
    if (paid < total) throw new Error('Payment is less than the total')
    const change = paid - total
    if (change > cashPaid) throw new Error('Only cash payments can give change')
    const netCash = cashPaid - change

    // 4. Receipt number: R20261108-00001
    const last = tx
      .select({ m: sql<number>`coalesce(max(${sales.id}), 0)` })
      .from(sales)
      .get()
    const day = new Date().toLocaleDateString('en-CA').replaceAll('-', '')
    const receiptNo = `R${day}-${String((last?.m ?? 0) + 1).padStart(5, '0')}`

    // 5. Save sale
    const sale = tx
      .insert(sales)
      .values({
        receiptNo,
        shiftId,
        userId: user.id,
        customerId: input.customerId ?? null,
        subtotalCents: subtotal,
        discountCents: discount,
        taxCents: tax,
        totalCents: total
      })
      .returning({ id: sales.id })
      .get()

    tx.insert(saleItems)
      .values(
        lines.map((l) => ({
          saleId: sale.id,
          productId: l.p.id,
          productName: l.p.name,
          qty: l.qty,
          unitPriceCents: l.p.priceCents,
          taxCents: l.lineTax,
          totalCents: l.lineSub + l.lineTax
        }))
      )
      .run()

    const payRows = input.payments.filter((x) => x.method !== 'cash')
    if (netCash > 0) payRows.push({ method: 'cash', amountCents: netCash })
    tx.insert(payments)
      .values(payRows.map((x) => ({ saleId: sale.id, ...x })))
      .run()

    // 6. Deduct stock + log movement
    for (const l of lines) {
      if (!l.p.trackStock) continue
      tx.update(products)
        .set({ stockQty: sql`${products.stockQty} - ${l.qty}` })
        .where(eq(products.id, l.p.id))
        .run()
      tx.insert(stockMovements)
        .values({
          productId: l.p.id,
          type: 'sale',
          qtyChange: -l.qty,
          userId: user.id,
          refSaleId: sale.id
        })
        .run()
    }

    if (discount > 0) {
      tx.insert(auditLogs).values({
        userId: user.id,
        action: 'sale.discount_applied',
        entity: 'sale',
        entityId: String(sale.id),
        details: JSON.stringify({ receiptNo, discountCents: discount, totalCents: total })
      }).run()
    }

    return {
      id: sale.id,
      receiptNo,
      subtotalCents: subtotal,
      discountCents: discount,
      taxCents: tax,
      totalCents: total,
      paidCents: paid,
      changeCents: change
    }
  })
}
