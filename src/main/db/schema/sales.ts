import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { users } from './users'
import { products } from './catalog'
import { customers } from './customers'

export const shifts = sqliteTable('shifts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  openedAt: integer('opened_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  closedAt: integer('closed_at', { mode: 'timestamp' }),
  openingCashCents: integer('opening_cash_cents').notNull().default(0),
  closingCashCents: integer('closing_cash_cents'),
  expectedCashCents: integer('expected_cash_cents'),
  status: text('status', { enum: ['open', 'closed'] })
    .notNull()
    .default('open')
})

export const sales = sqliteTable('sales', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  receiptNo: text('receipt_no').notNull().unique(),
  shiftId: integer('shift_id').references(() => shifts.id),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  customerId: integer('customer_id').references(() => customers.id),
  subtotalCents: integer('subtotal_cents').notNull(),
  discountCents: integer('discount_cents').notNull().default(0),
  taxCents: integer('tax_cents').notNull().default(0),
  totalCents: integer('total_cents').notNull(),
  status: text('status', { enum: ['completed', 'refunded', 'void'] })
    .notNull()
    .default('completed'),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
})

export const saleItems = sqliteTable('sale_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saleId: integer('sale_id')
    .notNull()
    .references(() => sales.id),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  productName: text('product_name').notNull(), // snapshot at time of sale
  qty: integer('qty').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
  discountCents: integer('discount_cents').notNull().default(0),
  taxCents: integer('tax_cents').notNull().default(0),
  totalCents: integer('total_cents').notNull()
})

export const payments = sqliteTable('payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saleId: integer('sale_id')
    .notNull()
    .references(() => sales.id),
  method: text('method', { enum: ['cash', 'card', 'other'] }).notNull(),
  amountCents: integer('amount_cents').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
})