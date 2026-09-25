import { Navigate, useLocation } from 'react-router-dom'
import { ROLE_PERMISSIONS } from '../../hooks/useRole'

function isTokenValid(token) {
  if (!token || token === 'demo-admin-token') return !!token
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 > Date.now()
  } catch { return false }
}

function getUserRole() {
  try {
    const user = JSON.parse(localStorage.getItem('admin-user') || '{}')
    return (user?.role || 'admin').toLowerCase()
  } catch { return 'admin' }
}

export default function AdminGuard({ children }) {
  const token    = localStorage.getItem('token')
  const location = useLocation()

  // Not logged in or expired token — clear all auth state including tenant context
  if (!isTokenValid(token)) {
    localStorage.removeItem('token')
    localStorage.removeItem('admin-user')
    const slug = localStorage.getItem('tenant_slug') || 'default'
    localStorage.removeItem(`menu-store-${slug}`)
    localStorage.removeItem('menu-store')
    localStorage.removeItem('tenant_slug')
    return <Navigate to="/admin/login" replace />
  }

  const role  = getUserRole()
  const perms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.admin

  // Waiter tries to access admin panel — send to /admin/orders (their allowed route)
  if (role === 'waiter' && !perms.routes.includes(location.pathname) &&
      !perms.routes.some(r => location.pathname.startsWith(r))) {
    return <Navigate to="/admin/orders" replace />
  }

  // Kitchen tries to access a restricted page — send to KDS
  if (role === 'kitchen' && !perms.routes.some(r => location.pathname.startsWith(r))) {
    return <Navigate to="/admin/kitchen" replace />
  }

  // Manager / barista can't access users or settings
  if ((role === 'manager' || role === 'barista') &&
      (location.pathname.startsWith('/admin/users') || location.pathname.startsWith('/admin/settings'))) {
    return <Navigate to="/admin" replace />
  }

  return children
}
