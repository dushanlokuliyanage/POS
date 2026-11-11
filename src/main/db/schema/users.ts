import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'
import { timestamps } from './_helpers'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  pinHash: text('pin_hash'),
  role: text('role', { enum: ['admin', 'manager', 'cashier'] })
    .notNull()
    .default('cashier'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps
})