import { BrowserWindow, dialog } from 'electron'
import { writeFileSync } from 'fs'
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { getDb } from '../db'
import { payments, products, saleItems, sales, users } from '../db/schema'
import { requireRole } from './auth.service'
import type { DateRange, PayMethod, ReportDTO, ReportKind } from '../../shared/types'

function bounds({ from, to }: DateRange): { start: Date; end: Date } {
  return { start: new Date(`${from}T00:00:00`), end: new Date(`${to}T23:59:59`) }
}

export function getReport(range: DateRange): ReportDTO {
  requireRole('admin', 'manager')
  const db = getDb()
  const { start, end } = bounds(range)
  const inRange = and(gte(sales.createdAt, start), lte(sales.createdAt, end))
  const done = and(inRange, eq(sales.status, 'completed'))

  const sum = db
    .select({
      count: sql<number>`count(*)`,
      subtotal: sql<number>`coalesce(sum(${sales.subtotalCents}), 0)`,
      discount: sql<number>`coalesce(sum(${sales.discountCents}), 0)`,
      tax: sql<number>`coalesce(sum(${sales.taxCents}), 0)`,
      revenue: sql<number>`coalesce(sum(${sales.totalCents}), 0)`
    })
    .from(sales)
    .where(done)
    .get()

  const voided = db
    .select({
      count: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${sales.totalCents}), 0)`
    })
    .from(sales)
    .where(and(inRange, eq(sales.status, 'void')))
    .get()

  // Cost uses the CURRENT cost price of each product
  const costRow = db
    .select({ cost: sql<number>`coalesce(sum(${saleItems.qty} * ${products.costCents}), 0)` })
    .from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .innerJoin(products, eq(products.id, saleItems.productId))
    .where(done)
    .get()

  const dayExpr = sql<string>`strftime('%Y-%m-%d', ${sales.createdAt}, 'unixepoch', 'localtime')`
  const daily = db
    .select({
      day: dayExpr,
      count: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(${sales.totalCents}), 0)`
    })
    .from(sales)
    .where(done)
    .groupBy(dayExpr)
    .orderBy(asc(dayExpr))
    .all()

  const revExpr = sql<number>`sum(${saleItems.totalCents} - ${saleItems.taxCents})`
  const costExpr = sql<number>`sum(${saleItems.qty} * ${products.costCents})`
  const prods = db
    .select({
      name: saleItems.productName,
      qty: sql<number>`sum(${saleItems.qty})`,
      revenue: revExpr,
      cost: costExpr
    })
    .from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .innerJoin(products, eq(products.id, saleItems.productId))
    .where(done)
    .groupBy(saleItems.productId, saleItems.productName)
    .orderBy(desc(revExpr))
    .all()

  const cashRevExpr = sql<number>`sum(${sales.totalCents})`
  const cashiers = db
    .select({ name: users.name, count: sql<number>`count(*)`, revenue: cashRevExpr })
    .from(sales)
    .innerJoin(users, eq(users.id, sales.userId))
    .where(done)
    .groupBy(sales.userId, users.name)
    .orderBy(desc(cashRevExpr))
    .all()

  const pays = db
    .select({
      method: payments.method,
      amount: sql<number>`coalesce(sum(${payments.amountCents}), 0)`
    })
    .from(payments)
    .innerJoin(sales, eq(sales.id, payments.saleId))
    .where(done)
    .groupBy(payments.method)
    .all()

  const revenue = sum?.revenue ?? 0
  const tax = sum?.tax ?? 0
  const cost = costRow?.cost ?? 0

  return {
    range,
    salesCount: sum?.count ?? 0,
    subtotalCents: sum?.subtotal ?? 0,
    discountCents: sum?.discount ?? 0,
    taxCents: tax,
    revenueCents: revenue,
    costCents: cost,
    profitCents: revenue - tax - cost,
    voidedCount: voided?.count ?? 0,
    voidedCents: voided?.total ?? 0,
    daily: daily.map((d) => ({ day: d.day, count: d.count, revenueCents: d.revenue })),
    products: prods.map((p) => ({
      name: p.name,
      qty: p.qty,
      revenueCents: p.revenue,
      profitCents: p.revenue - p.cost
    })),
    cashiers: cashiers.map((c) => ({ name: c.name, count: c.count, revenueCents: c.revenue })),
    payments: pays.map((p) => ({ method: p.method as PayMethod, amountCents: p.amount }))
  }
}

// ---------- CSV export ----------

type Cell = string | number
const money = (cents: number): number => cents / 100

// Text starting with = + - @ could run as a formula in Excel, so it gets a leading '
function cell(v: Cell): string {
  if (typeof v === 'number') return String(v)
  let s = v
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function exportCsv(input: DateRange & { kind: ReportKind }): Promise<string | null> {
  requireRole('admin', 'manager')

  let header: string[]
  let rows: Cell[][]

  if (input.kind === 'sales') {
    const { start, end } = bounds(input)
    const list = getDb()
      .select({
        receiptNo: sales.receiptNo,
        createdAt: sales.createdAt,
        cashier: users.name,
        subtotal: sales.subtotalCents,
        discount: sales.discountCents,
        tax: sales.taxCents,
        total: sales.totalCents,
        status: sales.status
      })
      .from(sales)
      .innerJoin(users, eq(users.id, sales.userId))
      .where(and(gte(sales.createdAt, start), lte(sales.createdAt, end)))
      .orderBy(asc(sales.id))
      .all()
    header = ['Receipt', 'Date', 'Cashier', 'Subtotal', 'Discount', 'Tax', 'Total', 'Status']
    rows = list.map((r) => [
      r.receiptNo,
      r.createdAt.toLocaleString('sv-SE'),
      r.cashier,
      money(r.subtotal),
      money(r.discount),
      money(r.tax),
      money(r.total),
      r.status
    ])
  } else if (input.kind === 'products') {
    const rep = getReport(input)
    header = ['Product', 'Qty sold', 'Revenue (excl. tax)', 'Profit']
    rows = rep.products.map((p) => [p.name, p.qty, money(p.revenueCents), money(p.profitCents)])
  } else {
    const rep = getReport(input)
    header = ['Date', 'Sales', 'Revenue']
    rows = rep.daily.map((d) => [d.day, d.count, money(d.revenueCents)])
  }

  const win = BrowserWindow.getFocusedWindow()
  const options = {
    title: 'Save CSV',
    defaultPath: `${input.kind}-${input.from}_${input.to}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  }
  const res = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
  if (res.canceled || !res.filePath) return null

  const text = [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
  writeFileSync(res.filePath, '\uFEFF' + text, 'utf8') // BOM so Excel reads it correctly
  return res.filePath
}