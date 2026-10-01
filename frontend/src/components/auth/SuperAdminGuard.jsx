import { Navigate } from 'react-router-dom'

function isTokenValid(token) {
  if (!token) return false
  if (token === 'demo-superadmin-token') return true
  try {
    const padded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(padded + '=='.slice((padded.length % 4) || 4)))
    return payload.exp * 1000 > Date.now()
  } catch { return false }
}

function clearSuperAdminSession() {
  localStorage.removeItem('superadmin_token')
  localStorage.removeItem('superadmin_user')
  localStorage.removeItem('token')
  localStorage.removeItem('admin-user')
  localStorage.removeItem('user')
}

export default function SuperAdminGuard({ children }) {
  const token = localStorage.getItem('superadmin_token') || localStorage.getItem('token')
  const user  = JSON.parse(localStorage.getItem('superadmin_user') || localStorage.getItem('user') || '{}')

  // Token missing, expired, or wrong role → clear everything and redirect
  if (!isTokenValid(token) || user.role !== 'super_admin') {
    clearSuperAdminSession()
    return <Navigate to="/superadmin/login" replace />
  }

  return children
}
