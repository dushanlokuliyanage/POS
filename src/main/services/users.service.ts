import bcrypt from 'bcryptjs'
import { asc, eq } from 'drizzle-orm'
import { getDb } from '../db'
import { users } from '../db/schema'
import { requireRole, requireUser } from './auth.service'
import type { UserCreateInput, UserDTO, UserUpdateInput } from '../../shared/types'
import { recordAudit } from './audit.service'

function friendly<T>(fn: () => T): T {
  try {
    return fn()
  } catch (e) {
    const m = e instanceof Error ? e.message : ''
    if (m.includes('UNIQUE') && m.includes('users.username')) {
      throw new Error('Username already exists', { cause: e })
    }
    throw e
  }
}

export function listUsers(): UserDTO[] {
  requireRole('admin')
  return getDb()
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      role: users.role,
      isActive: users.isActive
    })
    .from(users)
    .orderBy(asc(users.name))
    .all()
}

export function createUser(i: UserCreateInput): number {
  const actor = requireRole('admin')
  const id = friendly(
    () =>
      getDb()
        .insert(users)
        .values({
          name: i.name.trim(),
          username: i.username.trim().toLowerCase(),
          passwordHash: bcrypt.hashSync(i.password, 10),
          pinHash: i.pin ? bcrypt.hashSync(i.pin, 10) : null,
          role: i.role
        })
        .returning({ id: users.id })
        .get().id
  )
  recordAudit({ userId: actor.id, action: 'user.create', entity: 'user', entityId: id,
    details: { username: i.username.trim().toLowerCase(), role: i.role } })
  return id
}

export function updateUser(i: UserUpdateInput): boolean {
  const me = requireRole('admin')
  if (me.id === i.id && (i.role !== 'admin' || !i.isActive)) {
    throw new Error('You cannot remove your own admin access')
  }
  getDb()
    .update(users)
    .set({ name: i.name.trim(), role: i.role, isActive: i.isActive, updatedAt: new Date() })
    .where(eq(users.id, i.id))
    .run()
  recordAudit({ userId: me.id, action: 'user.update', entity: 'user', entityId: i.id,
    details: { name: i.name.trim(), role: i.role, isActive: i.isActive } })
  return true
}

export function resetPassword(id: number, password: string): boolean {
  const actor = requireRole('admin')
  getDb()
    .update(users)
    .set({ passwordHash: bcrypt.hashSync(password, 10), updatedAt: new Date() })
    .where(eq(users.id, id))
    .run()
  recordAudit({ userId: actor.id, action: 'user.password_reset', entity: 'user', entityId: id })
  return true
}

export function resetPin(id: number, pin: string): boolean {
  const actor = requireRole('admin')
  getDb()
    .update(users)
    .set({ pinHash: bcrypt.hashSync(pin, 10), updatedAt: new Date() })
    .where(eq(users.id, id))
    .run()
  recordAudit({ userId: actor.id, action: 'user.pin_reset', entity: 'user', entityId: id })
  return true
}

// ---------- own account (any logged-in user) ----------

function verifyOwnPassword(password: string): number {
  const me = requireUser()
  const row = getDb()
    .select({ hash: users.passwordHash })
    .from(users)
    .where(eq(users.id, me.id))
    .get()
  if (!row || !bcrypt.compareSync(password, row.hash)) {
    throw new Error('Current password is wrong')
  }
  return me.id
}

export function changeOwnPassword(current: string, next: string): boolean {
  const id = verifyOwnPassword(current)
  getDb()
    .update(users)
    .set({ passwordHash: bcrypt.hashSync(next, 10), updatedAt: new Date() })
    .where(eq(users.id, id))
    .run()
  recordAudit({ userId: id, action: 'account.password_changed', entity: 'user', entityId: id })
  return true
}

export function changeOwnPin(password: string, pin: string): boolean {
  const id = verifyOwnPassword(password)
  getDb()
    .update(users)
    .set({ pinHash: bcrypt.hashSync(pin, 10), updatedAt: new Date() })
    .where(eq(users.id, id))
    .run()
  recordAudit({ userId: id, action: 'account.pin_changed', entity: 'user', entityId: id })
  return true
}
