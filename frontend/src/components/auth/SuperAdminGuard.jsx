import { Navigate } from 'react-router-dom'

export default function SuperAdminGuard({ children }) {
  const token = localStorage.getItem('superadmin_token') || localStorage.getItem('token')
  const user = JSON.parse(localStorage.getItem('superadmin_user') || localStorage.getItem('user') || '{}')

  if (!token || user.role !== 'super_admin') {
    return <Navigate to="/superadmin/login" replace />
  }

  return children
}
