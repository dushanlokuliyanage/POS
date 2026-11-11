import bcrypt from 'bcryptjs'
import { and, eq } from 'drizzle-orm'
import { getDb } from '../db'
import { users } from '../db/schema'
import type { Role, SessionUser } from '../../shared/types'

// Logged-in user is kept in the main process, so the screen can't fake it
let current: SessionUser | null = null

export const getSession = (): SessionUser | null => current
export const setSession = (u: SessionUser | null): void => {
  current = u
}

export function requireUser(): SessionUser {
  if (!current) throw new Error('Not logged in')
  return current
}

export function requireRole(...roles: Role[]): SessionUser {
  const u = requireUser()
  if (!roles.includes(u.role)) throw new Error('You are not allowed to do this')
  return u
}

function findActive(username: string) {
  return getDb()
    .select()
    .from(users)
    .where(and(eq(users.username, username.trim().toLowerCase()), eq(users.isActive, true)))
    .get()
}

function toSession(u: NonNullable<ReturnType<typeof findActive>>): SessionUser {
  return { id: u.id, name: u.name, username: u.username, role: u.role }
}

export function loginWithPassword(username: string, password: string): SessionUser {
  const user = findActive(username)
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    throw new Error('Invalid username or password')
  }
  current = toSession(user)
  return current
}

export function loginWithPin(username: string, pin: string): SessionUser {
  const user = findActive(username)
  if (!user || !user.pinHash || !bcrypt.compareSync(pin, user.pinHash)) {
    throw new Error('Invalid username or PIN')
  }
  current = toSession(user)
  return current
}