export type Role = 'admin' | 'manager' | 'cashier'

export interface SessionUser {
  id: number
  name: string
  username: string
  role: Role
}

export interface UserDTO {
  id: number
  name: string
  username: string
  role: Role
  isActive: boolean
}

export interface UserCreateInput {
  name: string
  username: string
  password: string
  pin: string | null
  role: Role
}

export interface UserUpdateInput {
  id: number
  name: string
  role: Role
  isActive: boolean
}

export interface ProductDTO {
  id: number
  sku: string
  barcode: string | null
  name: string
  categoryId: number | null
  priceCents: number
  taxBps: number
  stockQty: number
  trackStock: boolean
}

export interface ProductAdminDTO {
  id: number
  sku: string
  barcode: string | null
  name: string
  categoryId: number | null
  categoryName: string | null
  priceCents: number
  costCents: number
  taxBps: number
  stockQty: number
  lowStockThreshold: number
  trackStock: boolean
  isActive: boolean
}

export interface ProductInput {
  sku: string
  barcode: string | null
  name: string
  categoryId: number | null
  priceCents: number
  costCents: number
  taxBps: number
  lowStockThreshold: number
  trackStock: boolean
  isActive: boolean
  openingStock: number // only used when creating
}

export interface StockAdjustInput {
  productId: number
  qtyChange: number
  reason: string
}

export interface SettingsDTO {
  storeName: string
  receiptFooter: string
}

export interface CategoryDTO {
  id: number
  name: string
}

export type PayMethod = 'cash' | 'card' | 'other'

export interface SaleInput {
  items: { productId: number; qty: number }[]
  discountCents: number
  customerId?: number | null
  payments: { method: PayMethod; amountCents: number }[]
}

export interface CustomerDTO {
  id: number
  name: string
  phone: string | null
  loyaltyPoints: number
}

export interface AuditLogDTO {
  id: number
  userName: string
  action: string
  entity: string | null
  entityId: string | null
  details: string | null
  createdAt: number
}

export interface SupplierDTO {
  id: number
  name: string
  phone: string | null
  email: string | null
}

export interface PurchaseReceiptDTO {
  id: number
  supplierName: string
  invoiceNo: string | null
  receivedBy: string
  createdAt: number
  totalCents: number
  items: { productName: string; qty: number; unitCostCents: number; totalCents: number }[]
}

export interface ReceiveStockInput {
  supplierId: number
  invoiceNo: string | null
  items: { productId: number; qty: number; unitCostCents: number }[]
}

export interface SaleResult {
  id: number
  receiptNo: string
  subtotalCents: number
  discountCents: number
  taxCents: number
  totalCents: number
  paidCents: number
  changeCents: number
}

export interface SaleSummaryDTO {
  id: number
  receiptNo: string
  createdAt: number // ms
  cashier: string
  totalCents: number
  status: 'completed' | 'refunded' | 'void'
}

export interface SaleDetailDTO extends SaleSummaryDTO {
  subtotalCents: number
  discountCents: number
  taxCents: number
  items: { name: string; qty: number; unitPriceCents: number; totalCents: number }[]
  payments: { method: PayMethod; amountCents: number }[]
}

export interface ShiftDTO {
  id: number
  cashier: string
  openedAt: number // ms
  closedAt: number | null
  status: 'open' | 'closed'
  openingCashCents: number
  closingCashCents: number | null // counted cash
  expectedCashCents: number // opening + cash sales
  varianceCents: number | null // counted - expected
  salesCount: number
  salesTotalCents: number
  cashSalesCents: number
}

export interface DateRange {
  from: string // YYYY-MM-DD
  to: string
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }

export interface DashboardDTO {
  scope: 'all' | 'mine'
  salesCount: number
  revenueCents: number
  itemsSold: number
  last7: { label: string; totalCents: number; count: number }[]
  topProducts: { name: string; qty: number; totalCents: number }[]
  lowStock: { id: number; name: string; stockQty: number; threshold: number }[]
  lowStockCount: number
}

export interface BackupInfoDTO {
  name: string
  sizeBytes: number
  modifiedAt: number // ms
}

export interface BackupListDTO {
  folder: string
  files: BackupInfoDTO[]
}

export type ReportKind = 'sales' | 'products' | 'daily'

export interface ReportDTO {
  range: DateRange
  salesCount: number
  subtotalCents: number
  discountCents: number
  taxCents: number
  revenueCents: number
  costCents: number
  profitCents: number
  voidedCount: number
  voidedCents: number
  daily: { day: string; count: number; revenueCents: number }[]
  products: { name: string; qty: number; revenueCents: number; profitCents: number }[]
  cashiers: { name: string; count: number; revenueCents: number }[]
  payments: { method: PayMethod; amountCents: number }[]
}
