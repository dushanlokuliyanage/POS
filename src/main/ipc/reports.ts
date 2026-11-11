import { z } from 'zod'
import { handle } from './helpers'
import { voidSale } from '../services/sales-void.service'
import { exportCsv, getReport } from '../services/reports.service'

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const rangeSchema = z.object({ from: dateStr, to: dateStr })
const exportSchema = rangeSchema.extend({ kind: z.enum(['sales', 'products', 'daily']) })
const voidSchema = z.object({
  id: z.number().int().positive(),
  reason: z.string().trim().min(1).max(200)
})

export function registerReportsIpc(): void {
  handle('sales:void', (input: unknown) => {
    const { id, reason } = voidSchema.parse(input)
    return voidSale(id, reason)
  })
  handle('reports:get', (input: unknown) => getReport(rangeSchema.parse(input)))
  handle('reports:exportCsv', (input: unknown) => exportCsv(exportSchema.parse(input)))
}