import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './stores/auth.store'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CheckoutPage from './pages/CheckoutPage'
import SalesPage from './pages/SalesPage'
import ProductsPage from './pages/ProductsPage'
import SettingsPage from './pages/SettingsPage'
import ShiftsPage from './pages/ShiftsPage'
import UsersPage from './pages/UsersPage'
import AccountPage from './pages/AccountPage'
import ReportsPage from './pages/ReportsPage'
import AuditPage from './pages/AuditPage'
import type { Role } from '../../shared/types'

function Protected({ children }: { children: React.JSX.Element }): React.JSX.Element {
  const { user, ready } = useAuth()
  if (!ready) return <div className="p-6">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RoleOnly({
  roles,
  children
}: {
  roles: Role[]
  children: React.JSX.Element
}): React.JSX.Element {
  const user = useAuth((s) => s.user)
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

export default function App(): React.JSX.Element {
  const init = useAuth((s) => s.init)
  useEffect(() => {
    init()
  }, [init])

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <Protected>
              <AppLayout />
            </Protected>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/sales" element={<SalesPage />} />
          <Route path="/shifts" element={<ShiftsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route
            path="/reports"
            element={
              <RoleOnly roles={['admin', 'manager']}>
                <ReportsPage />
              </RoleOnly>
            }
          />
          <Route
            path="/products"
            element={
              <RoleOnly roles={['admin', 'manager']}>
                <ProductsPage />
              </RoleOnly>
            }
          />
          <Route
            path="/users"
            element={
              <RoleOnly roles={['admin']}>
                <UsersPage />
              </RoleOnly>
            }
          />
          <Route
            path="/settings"
            element={
              <RoleOnly roles={['admin']}>
                <SettingsPage />
              </RoleOnly>
            }
          />
          <Route
            path="/audit"
            element={
              <RoleOnly roles={['admin']}>
                <AuditPage />
              </RoleOnly>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
