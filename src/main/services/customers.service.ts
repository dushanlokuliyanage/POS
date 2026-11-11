import { like, or, isNull, asc, and } from 'drizzle-orm'
import { getDb } from '../db'
import { customers } from '../db/schema'
import { requireUser } from './auth.service'
import type { CustomerDTO } from '../../shared/types'
import { recordAudit } from './audit.service'

export function listCustomers(search = ''): CustomerDTO[] {
  requireUser()
  const term = search.trim()
  return getDb()
    .select({ id: customers.id, name: customers.name, phone: customers.phone, loyaltyPoints: customers.loyaltyPoints })
    .from(customers)
    .where(term
      ? and(isNull(customers.deletedAt), or(like(customers.name, `%${term}%`), like(customers.phone, `%${term}%`)))
      : isNull(customers.deletedAt))
    .orderBy(asc(customers.name))
    .limit(20)
    .all()
}

export function createCustomer(input: { name: string; phone: string | null }): CustomerDTO {
  const user = requireUser()
  const phone = input.phone?.trim() || null
  try {
    const customer = getDb().insert(customers)
      .values({ name: input.name.trim(), phone })
      .returning({ id: customers.id, name: customers.name, phone: customers.phone, loyaltyPoints: customers.loyaltyPoints })
      .get()
    recordAudit({ userId: user.id, action: 'customer.create', entity: 'customer', entityId: customer.id,
      details: { name: customer.name, hasPhone: Boolean(customer.phone) } })
    return customer
  } catch (error) {
    if (phone && String(error).includes('UNIQUE')) {
      throw new Error('A customer with this phone number already exists', { cause: error })
    }
    throw error
  }
}
