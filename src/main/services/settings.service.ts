import { getDb } from '../db'
import { settings } from '../db/schema'
import { requireRole } from './auth.service'
import type { SettingsDTO } from '../../shared/types'
import { recordAudit } from './audit.service'

export function getSettings(): SettingsDTO {
  const map = new Map(
    getDb()
      .select()
      .from(settings)
      .all()
      .map((r) => [r.key, r.value])
  )
  return {
    storeName: map.get('store_name') ?? 'My Store',
    receiptFooter: map.get('receipt_footer') ?? ''
  }
}

export function saveSettings(input: SettingsDTO): SettingsDTO {
  const user = requireRole('admin')
  const rows = [
    { key: 'store_name', value: input.storeName.trim() },
    { key: 'receipt_footer', value: input.receiptFooter.trim() }
  ]
  getDb().transaction((tx) => {
    for (const r of rows) {
      tx.insert(settings)
        .values(r)
        .onConflictDoUpdate({ target: settings.key, set: { value: r.value } })
        .run()
    }
  })
  recordAudit({ userId: user.id, action: 'settings.update', entity: 'settings',
    details: { storeName: input.storeName.trim(), receiptFooterChanged: true } })
  return getSettings()
}
