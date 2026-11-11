import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  BackupListDTO,
  AuditLogDTO,
  CategoryDTO,
  CustomerDTO,
  DashboardDTO,
  DateRange,
  IpcResult,
  ProductAdminDTO,
  ProductDTO,
  ProductInput,
  ReportDTO,
  ReportKind,
  SaleDetailDTO,
  SaleInput,
  SaleResult,
  SaleSummaryDTO,
  SessionUser,
  SettingsDTO,
  ShiftDTO,
  StockAdjustInput,
  UserCreateInput,
  UserDTO,
  UserUpdateInput
} from '../shared/types'

const call = <T>(channel: string, ...args: unknown[]): Promise<IpcResult<T>> =>
  ipcRenderer.invoke(channel, ...args)

const api = {
  auth: {
    login: (username: string, password: string) =>
      call<SessionUser>('auth:login', { username, password }),
    loginPin: (username: string, pin: string) =>
      call<SessionUser>('auth:loginPin', { username, pin }),
    logout: () => call<boolean>('auth:logout'),
    me: () => call<SessionUser | null>('auth:me')
  },
  products: {
    list: (search?: string) => call<ProductDTO[]>('products:list', search),
    byBarcode: (barcode: string) => call<ProductDTO | null>('products:byBarcode', barcode),
    listAdmin: (search?: string) => call<ProductAdminDTO[]>('products:listAdmin', search),
    create: (input: ProductInput) => call<number>('products:create', input),
    update: (id: number, input: ProductInput) => call<boolean>('products:update', { id, input }),
    remove: (id: number) => call<boolean>('products:delete', id),
    adjust: (input: StockAdjustInput) => call<number>('products:adjust', input)
  },
  categories: {
    list: () => call<CategoryDTO[]>('categories:list'),
    create: (name: string) => call<CategoryDTO>('categories:create', name)
  },
  customers: {
    list: (search?: string) => call<CustomerDTO[]>('customers:list', search),
    create: (name: string, phone: string | null) =>
      call<CustomerDTO>('customers:create', { name, phone })
  },
  sales: {
    create: (input: SaleInput) => call<SaleResult>('sales:create', input),
    list: (range: DateRange) => call<SaleSummaryDTO[]>('sales:list', range),
    get: (id: number) => call<SaleDetailDTO>('sales:get', id),
    print: (id: number) => call<boolean>('sales:print', id),
    void: (id: number, reason: string) => call<boolean>('sales:void', { id, reason })
  },
  settings: {
    get: () => call<SettingsDTO>('settings:get'),
    save: (input: SettingsDTO) => call<SettingsDTO>('settings:save', input)
  },
  users: {
    list: () => call<UserDTO[]>('users:list'),
    create: (input: UserCreateInput) => call<number>('users:create', input),
    update: (input: UserUpdateInput) => call<boolean>('users:update', input),
    resetPassword: (id: number, password: string) =>
      call<boolean>('users:resetPassword', { id, password }),
    resetPin: (id: number, pin: string) => call<boolean>('users:resetPin', { id, pin })
  },
  account: {
    changePassword: (current: string, next: string) =>
      call<boolean>('account:changePassword', { current, next }),
    changePin: (password: string, pin: string) =>
      call<boolean>('account:changePin', { password, pin })
  },
  shifts: {
    current: () => call<ShiftDTO | null>('shifts:current'),
    open: (openingCashCents: number) => call<ShiftDTO>('shifts:open', openingCashCents),
    close: (countedCents: number) => call<ShiftDTO>('shifts:close', countedCents),
    list: (range: DateRange) => call<ShiftDTO[]>('shifts:list', range)
  },
  dashboard: {
    get: () => call<DashboardDTO>('dashboard:get')
  },
  backup: {
    list: () => call<BackupListDTO>('backup:list'),
    now: () => call<string | null>('backup:now'),
    restore: () => call<boolean>('backup:restore'),
    openFolder: () => call<string>('backup:openFolder')
  },
  audit: {
    list: () => call<AuditLogDTO[]>('audit:list')
  },
  reports: {
    get: (range: DateRange) => call<ReportDTO>('reports:get', range),
    exportCsv: (range: DateRange, kind: ReportKind) =>
      call<string | null>('reports:exportCsv', { ...range, kind })
  }
}

export type Api = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
