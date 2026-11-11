import { BrowserWindow } from 'electron'
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { getDb } from '../db'
import { payments, saleItems, sales, settings, users } from '../db/schema'
import type { DateRange, SaleDetailDTO, SaleSummaryDTO } from '../../shared/types'

export function listSales({ from, to }: DateRange): SaleSummaryDTO[] {
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T23:59:59`)
  const rows = getDb()
    .select({
      id: sales.id,
      receiptNo: sales.receiptNo,
      createdAt: sales.createdAt,
      cashier: users.name,
      totalCents: sales.totalCents,
      status: sales.status
    })
    .from(sales)
    .innerJoin(users, eq(users.id, sales.userId))
    .where(and(gte(sales.createdAt, start), lte(sales.createdAt, end)))
    .orderBy(desc(sales.id))
    .all()
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime() }))
}

export function getSaleDetail(id: number): SaleDetailDTO {
  const db = getDb()
  const sale = db
    .select({
      id: sales.id,
      receiptNo: sales.receiptNo,
      createdAt: sales.createdAt,
      cashier: users.name,
      subtotalCents: sales.subtotalCents,
      discountCents: sales.discountCents,
      taxCents: sales.taxCents,
      totalCents: sales.totalCents,
      status: sales.status
    })
    .from(sales)
    .innerJoin(users, eq(users.id, sales.userId))
    .where(eq(sales.id, id))
    .get()
  if (!sale) throw new Error('Sale not found')

  const items = db
    .select({
      name: saleItems.productName,
      qty: saleItems.qty,
      unitPriceCents: saleItems.unitPriceCents,
      totalCents: saleItems.totalCents
    })
    .from(saleItems)
    .where(eq(saleItems.saleId, id))
    .all()

  const pays = db
    .select({ method: payments.method, amountCents: payments.amountCents })
    .from(payments)
    .where(eq(payments.saleId, id))
    .all()

  return { ...sale, createdAt: sale.createdAt.getTime(), items, payments: pays }
}

// ---------- Receipt printing ----------

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }
    return map[c]
  })

const money = (cents: number): string => (cents / 100).toFixed(2)

function buildReceiptHtml(s: SaleDetailDTO): string {
  const cfg = new Map(
    getDb()
      .select()
      .from(settings)
      .all()
      .map((r) => [r.key, r.value])
  )
  const storeName = esc(cfg.get('store_name') ?? 'My Store')
  const footer = esc(cfg.get('receipt_footer') ?? '')
  const when = new Date(s.createdAt).toLocaleString('en-GB')

  const itemRows = s.items
    .map(
      (i) => `
      <div class="name">${esc(i.name)}</div>
      <div class="row"><span>${i.qty} x ${money(i.unitPriceCents)}</span><span>${money(i.totalCents)}</span></div>`
    )
    .join('')

  const payRows = s.payments
    .map(
      (p) =>
        `<div class="row"><span style="text-transform:capitalize">${p.method}</span><span>${money(p.amountCents)}</span></div>`
    )
    .join('')

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { margin: 0 }
    body { width: 72mm; margin: 0 auto; padding: 4mm 0; font: 12px/1.4 'Courier New', monospace; color: #000 }
    .c { text-align: center }
    .title { font-size: 16px; font-weight: bold }
    .row { display: flex; justify-content: space-between }
    .name { margin-top: 4px }
    .bold { font-weight: bold; font-size: 14px }
    hr { border: 0; border-top: 1px dashed #000; margin: 6px 0 }
  </style></head><body>
    <div class="c title">${storeName}</div>
    <div class="c">${esc(when)}</div>
    <div class="c">Receipt: ${esc(s.receiptNo)}</div>
    <div class="c">Cashier: ${esc(s.cashier)}</div>
    <hr>${itemRows}<hr>
    <div class="row"><span>Subtotal</span><span>${money(s.subtotalCents)}</span></div>
    ${s.discountCents > 0 ? `<div class="row"><span>Discount</span><span>-${money(s.discountCents)}</span></div>` : ''}
    ${s.taxCents > 0 ? `<div class="row"><span>Tax</span><span>${money(s.taxCents)}</span></div>` : ''}
    <div class="row bold"><span>TOTAL</span><span>${money(s.totalCents)}</span></div>
    <hr>${payRows}<hr>
    <div class="c">${footer}</div>
  </body></html>`
}

export async function printReceipt(saleId: number): Promise<void> {
  const html = buildReceiptHtml(getSaleDetail(saleId))
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    await new Promise<void>((resolve, reject) => {
      win.webContents.print({ silent: false, printBackground: false }, (success, reason) => {
        if (success || reason === 'cancelled') resolve()
        else reject(new Error(reason || 'Print failed'))
      })
    })
  } finally {
    win.close()
  }
}