import { eq, sql } from 'drizzle-orm'
import { getDb } from '../db'
import { auditLogs, products, saleItems, sales, shifts, stockMovements } from '../db/schema'
import { requireRole } from './auth.service'

export function voidSale(saleId: number, reason: string): boolean {
  const user = requireRole('admin', 'manager')

  return getDb().transaction((tx) => {
    const sale = tx
      .select({
        receiptNo: sales.receiptNo,
        status: sales.status,
        shiftId: sales.shiftId,
        totalCents: sales.totalCents
      })
      .from(sales)
      .where(eq(sales.id, saleId))
      .get()
    if (!sale) throw new Error('Sale not found')
    if (sale.status !== 'completed') throw new Error('This sale is already voided')

    const shift = sale.shiftId
      ? tx.select({ status: shifts.status }).from(shifts).where(eq(shifts.id, sale.shiftId)).get()
      : null
    if (!shift || shift.status !== 'open') {
      throw new Error('Only sales from a shift that is still open can be voided')
    }

    // Put stock back
    const items = tx
      .select({
        productId: saleItems.productId,
        qty: saleItems.qty,
        trackStock: products.trackStock
      })
      .from(saleItems)
      .innerJoin(products, eq(products.id, saleItems.productId))
      .where(eq(saleItems.saleId, saleId))
      .all()

    for (const it of items) {
      if (!it.trackStock) continue
      tx.update(products)
        .set({ stockQty: sql`${products.stockQty} + ${it.qty}` })
        .where(eq(products.id, it.productId))
        .run()
      tx.insert(stockMovements)
        .values({
          productId: it.productId,
          type: 'return',
          qtyChange: it.qty,
          reason: `Void ${sale.receiptNo}`,
          userId: user.id,
          refSaleId: saleId
        })
        .run()
    }

    tx.update(sales).set({ status: 'void', note: reason.trim() }).where(eq(sales.id, saleId)).run()

    tx.insert(auditLogs)
      .values({
        userId: user.id,
        action: 'sale.void',
        entity: 'sale',
        entityId: String(saleId),
        details: JSON.stringify({
          receiptNo: sale.receiptNo,
          totalCents: sale.totalCents,
          reason: reason.trim()
        })
      })
      .run()

    return true
  })
}