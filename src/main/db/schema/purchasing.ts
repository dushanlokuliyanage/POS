import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { users } from './users'
import { products } from './catalog'

export const suppliers = sqliteTable('suppliers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

export const purchaseReceipts = sqliteTable('purchase_receipts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  supplierId: integer('supplier_id').notNull().references(() => suppliers.id),
  invoiceNo: text('invoice_no'),
  receivedBy: integer('received_by').notNull().references(() => users.id),
  totalCents: integer('total_cents').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
})

export const purchaseReceiptItems = sqliteTable('purchase_receipt_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  receiptId: integer('receipt_id').notNull().references(() => purchaseReceipts.id),
  productId: integer('product_id').notNull().references(() => products.id),
  productName: text('product_name').notNull(),
  qty: integer('qty').notNull(),
  unitCostCents: integer('unit_cost_cents').notNull(),
  totalCents: integer('total_cents').notNull()
})
