import bcrypt from 'bcryptjs'
import { count } from 'drizzle-orm'
import type { AppDb } from './index'
import { users, categories, products, settings } from './schema'

export function seedIfEmpty(db: AppDb): void {
  const [{ value }] = db.select({ value: count() }).from(users).all()
  if (value > 0) return

  db.transaction((tx) => {
    tx.insert(users)
      .values({
        name: 'Administrator',
        username: 'admin',
        passwordHash: bcrypt.hashSync('admin123', 10),
        pinHash: bcrypt.hashSync('1234', 10),
        role: 'admin'
      })
      .run()

    tx.insert(settings)
      .values([
        { key: 'store_name', value: 'My Store' },
        { key: 'currency', value: 'LKR' },
        { key: 'receipt_footer', value: 'Thank you! Come again.' }
      ])
      .run()

    const cats = tx
      .insert(categories)
      .values([{ name: 'Drinks' }, { name: 'Snacks' }, { name: 'Other' }])
      .returning()
      .all()
    const drinksId = cats.find((c) => c.name === 'Drinks')!.id
    const snacksId = cats.find((c) => c.name === 'Snacks')!.id

    tx.insert(products)
      .values([
        { sku: 'DRK-001', barcode: '1000000000001', name: 'Mineral Water 500ml', categoryId: drinksId, priceCents: 10000, costCents: 6000, stockQty: 100 },
        { sku: 'DRK-002', barcode: '1000000000002', name: 'Orange Juice', categoryId: drinksId, priceCents: 25000, costCents: 15000, stockQty: 50 },
        { sku: 'SNK-001', barcode: '1000000000003', name: 'Chocolate Bar', categoryId: snacksId, priceCents: 18000, costCents: 11000, stockQty: 80 },
        { sku: 'SNK-002', barcode: '1000000000004', name: 'Biscuit Pack', categoryId: snacksId, priceCents: 12000, costCents: 7000, stockQty: 120 }
      ])
      .run()
  })

  console.log('[db] seeded: admin user + sample data')
}