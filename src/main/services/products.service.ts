import { and, asc, eq, isNull, like, or } from 'drizzle-orm'
import { getDb } from '../db'
import { categories, products } from '../db/schema'
import type { CategoryDTO, ProductDTO } from '../../shared/types'

const fields = {
  id: products.id,
  sku: products.sku,
  barcode: products.barcode,
  name: products.name,
  categoryId: products.categoryId,
  priceCents: products.priceCents,
  taxBps: products.taxBps,
  stockQty: products.stockQty,
  trackStock: products.trackStock
}

export function listProducts(search?: string): ProductDTO[] {
  const q = search?.trim()
  const conditions = [isNull(products.deletedAt), eq(products.isActive, true)]
  if (q) {
    conditions.push(
      or(
        like(products.name, `%${q}%`),
        like(products.sku, `%${q}%`),
        like(products.barcode, `%${q}%`)
      )!
    )
  }
  return getDb()
    .select(fields)
    .from(products)
    .where(and(...conditions))
    .orderBy(asc(products.name))
    .all()
}

export function findByBarcode(barcode: string): ProductDTO | null {
  return (
    getDb()
      .select(fields)
      .from(products)
      .where(
        and(
          eq(products.barcode, barcode),
          isNull(products.deletedAt),
          eq(products.isActive, true)
        )
      )
      .get() ?? null
  )
}

export function listCategories(): CategoryDTO[] {
  return getDb()
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.name))
    .all()
}