import { and, asc, eq, isNull, like, or } from 'drizzle-orm'
import { getDb } from '../db'
import { categories, products, stockMovements } from '../db/schema'
import { requireRole } from './auth.service'
import { recordAudit } from './audit.service'
import type { CategoryDTO, ProductAdminDTO, ProductInput, StockAdjustInput } from '../../shared/types'

const clean = (s: string | null): string | null => {
  const t = s?.trim()
  return t ? t : null
}

function toValues(i: ProductInput): typeof products.$inferInsert {
  return {
    sku: i.sku.trim(),
    barcode: clean(i.barcode),
    name: i.name.trim(),
    categoryId: i.categoryId,
    priceCents: i.priceCents,
    costCents: i.costCents,
    taxBps: i.taxBps,
    lowStockThreshold: i.lowStockThreshold,
    trackStock: i.trackStock,
    isActive: i.isActive
  }
}

// Turns SQLite "UNIQUE constraint" errors into friendly messages
function friendly<T>(fn: () => T): T {
  try {
    return fn()
  } catch (e) {
    const m = e instanceof Error ? e.message : ''
    if (m.includes('UNIQUE') && m.includes('products.sku')) throw new Error('SKU already exists', { cause: e })
    if (m.includes('UNIQUE') && m.includes('products.barcode')) throw new Error('Barcode already exists', { cause: e })
    if (m.includes('UNIQUE') && m.includes('categories.name')) throw new Error('Category already exists', { cause: e })
    throw e
  }
}

export function listProductsAdmin(search?: string): ProductAdminDTO[] {
  requireRole('admin', 'manager')
  const q = search?.trim()
  const conds = [isNull(products.deletedAt)]
  if (q) {
    conds.push(
      or(
        like(products.name, `%${q}%`),
        like(products.sku, `%${q}%`),
        like(products.barcode, `%${q}%`)
      )!
    )
  }
  return getDb()
    .select({
      id: products.id,
      sku: products.sku,
      barcode: products.barcode,
      name: products.name,
      categoryId: products.categoryId,
      categoryName: categories.name,
      priceCents: products.priceCents,
      costCents: products.costCents,
      taxBps: products.taxBps,
      stockQty: products.stockQty,
      lowStockThreshold: products.lowStockThreshold,
      trackStock: products.trackStock,
      isActive: products.isActive
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(...conds))
    .orderBy(asc(products.name))
    .all()
}

export function createProduct(input: ProductInput): number {
  const user = requireRole('admin', 'manager')
  const id = friendly(() =>
    getDb().transaction((tx) => {
      const row = tx
        .insert(products)
        .values({ ...toValues(input), stockQty: input.openingStock })
        .returning({ id: products.id })
        .get()
      if (input.openingStock > 0) {
        tx.insert(stockMovements)
          .values({
            productId: row.id,
            type: 'adjustment',
            qtyChange: input.openingStock,
            reason: 'Opening stock',
            userId: user.id
          })
          .run()
      }
      return row.id
    })
  )
  recordAudit({ userId: user.id, action: 'product.create', entity: 'product', entityId: id,
    details: { sku: input.sku.trim(), name: input.name.trim(), priceCents: input.priceCents, openingStock: input.openingStock } })
  return id
}

export function updateProduct(id: number, input: ProductInput): boolean {
  const user = requireRole('admin', 'manager')
  const before = getDb().select({ sku: products.sku, name: products.name, priceCents: products.priceCents, costCents: products.costCents, stockQty: products.stockQty })
    .from(products).where(and(eq(products.id, id), isNull(products.deletedAt))).get()
  if (!before) throw new Error('Product not found')
  friendly(() =>
    getDb()
      .update(products)
      .set({ ...toValues(input), updatedAt: new Date() })
      .where(and(eq(products.id, id), isNull(products.deletedAt)))
      .run()
  )
  recordAudit({ userId: user.id, action: 'product.update', entity: 'product', entityId: id,
    details: { before, after: { sku: input.sku.trim(), name: input.name.trim(), priceCents: input.priceCents, costCents: input.costCents, stockQty: before.stockQty } } })
  return true
}

// Soft delete: the row stays (old sales keep working), SKU + barcode are freed for reuse
export function deleteProduct(id: number): boolean {
  const user = requireRole('admin', 'manager')
  const p = getDb().select({ sku: products.sku, name: products.name }).from(products).where(eq(products.id, id)).get()
  if (!p) throw new Error('Product not found')
  getDb()
    .update(products)
    .set({ deletedAt: new Date(), isActive: false, barcode: null, sku: `${p.sku}#del${id}` })
    .where(eq(products.id, id))
    .run()
  recordAudit({ userId: user.id, action: 'product.delete', entity: 'product', entityId: id, details: p })
  return true
}

export function adjustStock(input: StockAdjustInput): number {
  const user = requireRole('admin', 'manager')
  const next = getDb().transaction((tx) => {
    const p = tx
      .select({ stockQty: products.stockQty })
      .from(products)
      .where(and(eq(products.id, input.productId), isNull(products.deletedAt)))
      .get()
    if (!p) throw new Error('Product not found')
    const next = p.stockQty + input.qtyChange
    if (next < 0) throw new Error('Stock cannot go below zero')

    tx.update(products)
      .set({ stockQty: next, updatedAt: new Date() })
      .where(eq(products.id, input.productId))
      .run()
    tx.insert(stockMovements)
      .values({
        productId: input.productId,
        type: 'adjustment',
        qtyChange: input.qtyChange,
        reason: input.reason.trim(),
        userId: user.id
      })
      .run()
    return next
  })
  recordAudit({ userId: user.id, action: 'stock.adjust', entity: 'product', entityId: input.productId,
    details: { qtyChange: input.qtyChange, reason: input.reason.trim(), stockAfter: next } })
  return next
}

export function createCategory(name: string): CategoryDTO {
  const user = requireRole('admin', 'manager')
  const category = friendly(() =>
    getDb()
      .insert(categories)
      .values({ name: name.trim() })
      .returning({ id: categories.id, name: categories.name })
      .get()
  )
  recordAudit({ userId: user.id, action: 'category.create', entity: 'category', entityId: category.id, details: { name: category.name } })
  return category
}
