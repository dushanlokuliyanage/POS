import { z } from 'zod'
import { handle } from './helpers'
import {
  getSession,
  loginWithPassword,
  loginWithPin,
  requireUser,
  setSession
} from '../services/auth.service'
import { findByBarcode, listCategories, listProducts } from '../services/products.service'
import {
  adjustStock,
  createCategory,
  createProduct,
  deleteProduct,
  listProductsAdmin,
  updateProduct
} from '../services/products-admin.service'
import { createSale } from '../services/sales.service'
import { getSaleDetail, listSales, printReceipt } from '../services/sales-history.service'
import { getSettings, saveSettings } from '../services/settings.service'
import {
  changeOwnPassword,
  changeOwnPin,
  createUser,
  listUsers,
  resetPassword,
  resetPin,
  updateUser
} from '../services/users.service'
import { closeShift, getCurrentShift, listShifts, openShift } from '../services/shifts.service'
import { getDashboard } from '../services/dashboard.service'
import { createCustomer, listCustomers } from '../services/customers.service'
import { listAuditLogs } from '../services/audit.service'
import {
  backupNow,
  listBackups,
  openBackupFolder,
  restoreBackup
} from '../services/backup.service'

const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) })
const pinSchema = z.object({ username: z.string().min(1), pin: z.string().min(1) })

const saleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        qty: z.number().int().positive().max(9999)
      })
    )
    .min(1),
  discountCents: z.number().int().min(0),
  customerId: z.number().int().positive().nullable().optional(),
  payments: z
    .array(
      z.object({
        method: z.enum(['cash', 'card', 'other']),
        amountCents: z.number().int().positive()
      })
    )
    .min(1)
})
const customerCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(30).nullable()
})

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const rangeSchema = z.object({ from: dateStr, to: dateStr })
const idSchema = z.number().int().positive()

const productSchema = z.object({
  sku: z.string().trim().min(1).max(50),
  barcode: z.string().trim().max(50).nullable(),
  name: z.string().trim().min(1).max(120),
  categoryId: z.number().int().positive().nullable(),
  priceCents: z.number().int().min(0),
  costCents: z.number().int().min(0),
  taxBps: z.number().int().min(0).max(10000),
  lowStockThreshold: z.number().int().min(0),
  trackStock: z.boolean(),
  isActive: z.boolean(),
  openingStock: z.number().int().min(0)
})
const updateSchema = z.object({ id: idSchema, input: productSchema })
const adjustSchema = z.object({
  productId: idSchema,
  qtyChange: z.number().int().refine((n) => n !== 0, 'Change cannot be 0'),
  reason: z.string().trim().min(1).max(200)
})
const categoryName = z.string().trim().min(1).max(60)
const settingsSchema = z.object({
  storeName: z.string().trim().min(1).max(100),
  receiptFooter: z.string().trim().max(200)
})

// users
const roleZ = z.enum(['admin', 'manager', 'cashier'])
const usernameZ = z.string().trim().regex(/^[a-zA-Z0-9._-]{3,30}$/)
const passwordZ = z.string().min(6).max(100)
const pinZ = z.string().regex(/^\d{4,8}$/)
const userCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  username: usernameZ,
  password: passwordZ,
  pin: pinZ.nullable(),
  role: roleZ
})
const userUpdateSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(100),
  role: roleZ,
  isActive: z.boolean()
})
const resetPasswordSchema = z.object({ id: idSchema, password: passwordZ })
const resetPinSchema = z.object({ id: idSchema, pin: pinZ })
const changePasswordSchema = z.object({ current: z.string().min(1), next: passwordZ })
const changePinSchema = z.object({ password: z.string().min(1), pin: pinZ })

const cashZ = z.number().int().min(0).max(1_000_000_000)

export function registerIpc(): void {
  // Auth
  handle('auth:login', (input: unknown) => {
    const { username, password } = loginSchema.parse(input)
    return loginWithPassword(username, password)
  })
  handle('auth:loginPin', (input: unknown) => {
    const { username, pin } = pinSchema.parse(input)
    return loginWithPin(username, pin)
  })
  handle('auth:logout', () => {
    setSession(null)
    return true
  })
  handle('auth:me', () => getSession())

  // Products (checkout)
  handle('products:list', (search?: unknown) => {
    requireUser()
    return listProducts(typeof search === 'string' ? search : undefined)
  })
  handle('products:byBarcode', (barcode: unknown) => {
    requireUser()
    return findByBarcode(z.string().min(1).parse(barcode))
  })
  handle('categories:list', () => {
    requireUser()
    return listCategories()
  })

  // Products (management, role checked inside the services)
  handle('products:listAdmin', (search?: unknown) =>
    listProductsAdmin(typeof search === 'string' ? search : undefined)
  )
  handle('products:create', (input: unknown) => createProduct(productSchema.parse(input)))
  handle('products:update', (input: unknown) => {
    const { id, input: data } = updateSchema.parse(input)
    return updateProduct(id, data)
  })
  handle('products:delete', (id: unknown) => deleteProduct(idSchema.parse(id)))
  handle('products:adjust', (input: unknown) => adjustStock(adjustSchema.parse(input)))
  handle('categories:create', (name: unknown) => createCategory(categoryName.parse(name)))

  // Customers
  handle('customers:list', (search?: unknown) => {
    requireUser()
    return listCustomers(typeof search === 'string' ? search : '')
  })
  handle('customers:create', (input: unknown) =>
    createCustomer(customerCreateSchema.parse(input))
  )

  // Sales
  handle('sales:create', (input: unknown) => {
    requireUser()
    return createSale(saleSchema.parse(input))
  })
  handle('sales:list', (input: unknown) => {
    requireUser()
    return listSales(rangeSchema.parse(input))
  })
  handle('sales:get', (id: unknown) => {
    requireUser()
    return getSaleDetail(idSchema.parse(id))
  })
  handle('sales:print', async (id: unknown) => {
    requireUser()
    await printReceipt(idSchema.parse(id))
    return true
  })

  // Settings
  handle('settings:get', () => {
    requireUser()
    return getSettings()
  })
  handle('settings:save', (input: unknown) => saveSettings(settingsSchema.parse(input)))

  // Users (admin only, checked inside the services)
  handle('users:list', () => listUsers())
  handle('users:create', (input: unknown) => createUser(userCreateSchema.parse(input)))
  handle('users:update', (input: unknown) => updateUser(userUpdateSchema.parse(input)))
  handle('users:resetPassword', (input: unknown) => {
    const { id, password } = resetPasswordSchema.parse(input)
    return resetPassword(id, password)
  })
  handle('users:resetPin', (input: unknown) => {
    const { id, pin } = resetPinSchema.parse(input)
    return resetPin(id, pin)
  })

  // Own account
  handle('account:changePassword', (input: unknown) => {
    const { current, next } = changePasswordSchema.parse(input)
    return changeOwnPassword(current, next)
  })
  handle('account:changePin', (input: unknown) => {
    const { password, pin } = changePinSchema.parse(input)
    return changeOwnPin(password, pin)
  })

  // Shifts
  handle('shifts:current', () => getCurrentShift())
  handle('shifts:open', (cents: unknown) => openShift(cashZ.parse(cents)))
  handle('shifts:close', (cents: unknown) => closeShift(cashZ.parse(cents)))
  handle('shifts:list', (input: unknown) => listShifts(rangeSchema.parse(input)))

  // Dashboard
  handle('dashboard:get', () => getDashboard())

  // Backup (admin only, checked inside the service)
  handle('backup:list', () => listBackups())
  handle('backup:now', () => backupNow())
  handle('backup:restore', () => restoreBackup())
  handle('backup:openFolder', () => openBackupFolder())

  // Audit history (admin only)
  handle('audit:list', () => listAuditLogs())
}
