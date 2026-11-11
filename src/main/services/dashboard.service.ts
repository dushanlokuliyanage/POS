import { and, asc, desc, eq, gte, isNull, sql } from 'drizzle-orm'
import { getDb } from '../db'
import { products, saleItems, sales } from '../db/schema'
import { requireUser } from './auth.service'
import type { DashboardDTO } from '../../shared/types'

export function getDashboard(): DashboardDTO {
  const user = requireUser()
  const db = getDb()
  const mine = user.role === 'cashier'

  const startToday = new Date()
  startToday.setHours(0, 0, 0, 0)
  const start7 = new Date(startToday)
  start7.setDate(start7.getDate() - 6)

  // completed sales since a date (cashiers: only their own)
  const scope = (from: Date) => {
    const c = [gte(sales.createdAt, from), eq(sales.status, 'completed')]
    if (mine) c.push(eq(sales.userId, user.id))
    return and(...c)
  }

  const today = db
    .select({
      count: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${sales.totalCents}), 0)`
    })
    .from(sales)
    .where(scope(startToday))
    .get()

  const items = db
    .select({ qty: sql<number>`coalesce(sum(${saleItems.qty}), 0)` })
    .from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .where(scope(startToday))
    .get()

  // last 7 days
  const dayExpr = sql<string>`strftime('%Y-%m-%d', ${sales.createdAt}, 'unixepoch', 'localtime')`
  const dayRows = db
    .select({
      day: dayExpr,
      total: sql<number>`coalesce(sum(${sales.totalCents}), 0)`,
      count: sql<number>`count(*)`
    })
    .from(sales)
    .where(scope(start7))
    .groupBy(dayExpr)
    .all()
  const byDay = new Map(dayRows.map((r) => [r.day, r]))
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start7)
    d.setDate(start7.getDate() + i)
    const r = byDay.get(d.toLocaleDateString('en-CA'))
    return {
      label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
      totalCents: r?.total ?? 0,
      count: r?.count ?? 0
    }
  })

  // top products today
  const qtyExpr = sql<number>`sum(${saleItems.qty})`
  const topProducts = db
    .select({
      name: saleItems.productName,
      qty: qtyExpr,
      total: sql<number>`sum(${saleItems.totalCents})`
    })
    .from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .where(scope(startToday))
    .groupBy(saleItems.productId, saleItems.productName)
    .orderBy(desc(qtyExpr))
    .limit(5)
    .all()
    .map((r) => ({ name: r.name, qty: r.qty, totalCents: r.total }))

  // low stock
  const low = db
    .select({
      id: products.id,
      name: products.name,
      stockQty: products.stockQty,
      threshold: products.lowStockThreshold
    })
    .from(products)
    .where(
      and(
        isNull(products.deletedAt),
        eq(products.isActive, true),
        eq(products.trackStock, true),
        sql`${products.stockQty} <= ${products.lowStockThreshold}`
      )
    )
    .orderBy(asc(products.stockQty))
    .all()

  return {
    scope: mine ? 'mine' : 'all',
    salesCount: today?.count ?? 0,
    revenueCents: today?.total ?? 0,
    itemsSold: items?.qty ?? 0,
    last7,
    topProducts,
    lowStock: low.slice(0, 8),
    lowStockCount: low.length
  }
}