import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Clock,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  TrendingUp,
  Users
} from 'lucide-react'
import { useAuth } from '../../stores/auth.store'
import { cn } from '../../lib/utils'
import type { Role } from '../../../../shared/types'

const nav: { to: string; label: string; icon: typeof Settings; roles?: Role[] }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/checkout', label: 'Checkout', icon: ShoppingCart },
  { to: '/sales', label: 'Sales', icon: Receipt },
  { to: '/shifts', label: 'Shifts', icon: Clock },
  { to: '/reports', label: 'Reports', icon: TrendingUp, roles: ['admin', 'manager'] },
  { to: '/products', label: 'Products', icon: Package, roles: ['admin', 'manager'] },
  { to: '/users', label: 'Users', icon: Users, roles: ['admin'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
  { to: '/audit', label: 'Audit history', icon: ClipboardList, roles: ['admin'] }
]

export default function AppLayout(): React.JSX.Element {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await window.api.settings.get()
      if (!res.ok) throw new Error(res.error)
      return res.data
    }
  })

  const { data: shift } = useQuery({
    queryKey: ['current-shift'],
    queryFn: async () => {
      const res = await window.api.shifts.current()
      if (!res.ok) throw new Error(res.error)
      return res.data
    },
    enabled: !!user
  })

  const items = nav.filter((n) => !n.roles || (user && n.roles.includes(user.role)))
  const noShift = shift === null && pathname !== '/shifts'

  return (
    <div className="flex h-full bg-slate-100">
      <aside className="flex w-56 flex-col bg-slate-900 text-slate-200">
        <div className="truncate px-5 py-4 text-lg font-bold text-white">
          {settings?.storeName ?? 'My POS'}
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 text-sm',
                  isActive ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-700 p-4 text-sm">
          <NavLink to="/account" className="block hover:underline">
            <div className="font-medium text-white">{user?.name}</div>
            <div className="mb-3 capitalize text-slate-400">{user?.role} · My account</div>
          </NavLink>
          <button
            onClick={() => logout()}
            className="flex items-center gap-2 text-slate-300 hover:text-white"
          >
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {noShift && (
          <div className="flex items-center justify-between border-b border-amber-300 bg-amber-100 px-6 py-2 text-sm text-amber-900">
            <span>No open shift. You cannot sell until you open one.</span>
            <Link to="/shifts" className="font-medium underline">
              Open shift
            </Link>
          </div>
        )}
        <main className="min-h-0 flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
