import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'
import { timestamps } from './_helpers'

export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  phone: text('phone').unique(),
  email: text('email'),
  loyaltyPoints: integer('loyalty_points').notNull().default(0),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  ...timestamps
})