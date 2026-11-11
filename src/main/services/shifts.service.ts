import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { getDb } from '../db'
import { payments, sales, shifts, users } from '../db/schema'
import { requireUser } from './auth.service'
import type { DateRange, ShiftDTO } from '../../shared/types'
import { recordAudit } from './audit.service'

export function getOpenShiftId(userId: number): number | null {
  const row = getDb()
    .select({ id: shifts.id })
    .from(shifts)
    .where(and(eq(shifts.userId, userId), eq(shifts.status, 'open')))
    .get()
  return row?.id ?? null
}

function stats(shiftId: number): { count: number; total: number; cash: number } {
  const db = getDb()
  const s = db
    .select({
      count: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${sales.totalCents}), 0)`
    })
    .from(sales)
    .where(and(eq(sales.shiftId, shiftId), eq(sales.status, 'completed')))
    .get()
  const c = db
    .select({ cash: sql<number>`coalesce(sum(${payments.amountCents}), 0)` })
    .from(payments)
    .innerJoin(sales, eq(sales.id, payments.saleId))
    .where(
      and(eq(sales.shiftId, shiftId), eq(sales.status, 'completed'), eq(payments.method, 'cash'))
    )
    .get()
  return { count: s?.count ?? 0, total: s?.total ?? 0, cash: c?.cash ?? 0 }
}

function load(id: number): ShiftDTO {
  const r = getDb()
    .select({
      id: shifts.id,
      cashier: users.name,
      openedAt: shifts.openedAt,
      closedAt: shifts.closedAt,
      status: shifts.status,
      openingCashCents: shifts.openingCashCents,
      closingCashCents: shifts.closingCashCents,
      expectedCashCents: shifts.expectedCashCents
    })
    .from(shifts)
    .innerJoin(users, eq(users.id, shifts.userId))
    .where(eq(shifts.id, id))
    .get()
  if (!r) throw new Error('Shift not found')

  const st = stats(id)
  const expected =
    r.status === 'open'
      ? r.openingCashCents + st.cash
      : (r.expectedCashCents ?? r.openingCashCents + st.cash)

  return {
    id: r.id,
    cashier: r.cashier,
    openedAt: r.openedAt.getTime(),
    closedAt: r.closedAt ? r.closedAt.getTime() : null,
    status: r.status,
    openingCashCents: r.openingCashCents,
    closingCashCents: r.closingCashCents,
    expectedCashCents: expected,
    varianceCents: r.closingCashCents === null ? null : r.closingCashCents - expected,
    salesCount: st.count,
    salesTotalCents: st.total,
    cashSalesCents: st.cash
  }
}

export function getCurrentShift(): ShiftDTO | null {
  const u = requireUser()
  const id = getOpenShiftId(u.id)
  return id ? load(id) : null
}

export function openShift(openingCashCents: number): ShiftDTO {
  const u = requireUser()
  if (getOpenShiftId(u.id)) throw new Error('You already have an open shift')
  const row = getDb()
    .insert(shifts)
    .values({ userId: u.id, openingCashCents })
    .returning({ id: shifts.id })
    .get()
  recordAudit({ userId: u.id, action: 'shift.open', entity: 'shift', entityId: row.id, details: { openingCashCents } })
  return load(row.id)
}

export function closeShift(countedCents: number): ShiftDTO {
  const u = requireUser()
  const id = getOpenShiftId(u.id)
  if (!id) throw new Error('You have no open shift')
  const cur = load(id)
  getDb()
    .update(shifts)
    .set({
      closedAt: new Date(),
      closingCashCents: countedCents,
      expectedCashCents: cur.expectedCashCents,
      status: 'closed'
    })
    .where(eq(shifts.id, id))
    .run()
  recordAudit({ userId: u.id, action: 'shift.close', entity: 'shift', entityId: id,
    details: { countedCents, expectedCashCents: cur.expectedCashCents, varianceCents: countedCents - cur.expectedCashCents } })
  return load(id)
}

// Cashiers see only their own shifts. Admin and manager see everyone's.
export function listShifts({ from, to }: DateRange): ShiftDTO[] {
  const u = requireUser()
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T23:59:59`)
  const conds = [gte(shifts.openedAt, start), lte(shifts.openedAt, end)]
  if (u.role === 'cashier') conds.push(eq(shifts.userId, u.id))
  const ids = getDb()
    .select({ id: shifts.id })
    .from(shifts)
    .where(and(...conds))
    .orderBy(desc(shifts.id))
    .all()
  return ids.map((r) => load(r.id))
}
