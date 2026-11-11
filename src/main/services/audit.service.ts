import { desc, eq } from 'drizzle-orm'
import { getDb } from '../db'
import { auditLogs, users } from '../db/schema'
import { requireRole } from './auth.service'
import type { AuditLogDTO } from '../../shared/types'

export function recordAudit(input: {
  userId: number
  action: string
  entity?: string | null
  entityId?: string | number | null
  details?: unknown
}): void {
  getDb().insert(auditLogs).values({
    userId: input.userId,
    action: input.action,
    entity: input.entity ?? null,
    entityId: input.entityId == null ? null : String(input.entityId),
    details: input.details == null ? null : JSON.stringify(input.details)
  }).run()
}

export function listAuditLogs(): AuditLogDTO[] {
  requireRole('admin')
  return getDb().select({
    id: auditLogs.id,
    userName: users.name,
    action: auditLogs.action,
    entity: auditLogs.entity,
    entityId: auditLogs.entityId,
    details: auditLogs.details,
    createdAt: auditLogs.createdAt
  }).from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .orderBy(desc(auditLogs.id))
    .limit(500)
    .all()
    .map((row) => ({ ...row, userName: row.userName ?? 'System', createdAt: row.createdAt.getTime() }))
}
