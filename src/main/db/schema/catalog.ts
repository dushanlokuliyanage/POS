import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { timestamps } from './_helpers'
import { users } from './users'

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps
})

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sku: text('sku').notNull().unique(),
  barcode: text('barcode').unique(),
  name: text('name').notNull(),
  categoryId: integer('category_id').references(() => categories.id),
  priceCents: integer('price_cents').notNull(),
  costCents: integer('cost_cents').notNull().default(0),
  taxBps: integer('tax_bps').notNull().default(0), // 1500 = 15%
  stockQty: integer('stock_qty').notNull().default(0),
  lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
  trackStock: integer('track_stock', { mode: 'boolean' }).notNull().default(true),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  ...timestamps
})

export const stockMovements = sqliteTable('stock_movements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  type: text('type', { enum: ['sale', 'purchase', 'adjustment', 'return'] }).notNull(),
  qtyChange: integer('qty_change').notNull(), // negative = stock out
  reason: text('reason'),
  userId: integer('user_id').references(() => users.id),
  refSaleId: integer('ref_sale_id'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
})