import axios from 'axios'

// Use environment variable for remote backend, fallback to relative path
const API_URL = import.meta.env.VITE_API_URL || '/api'

const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  // Superadmin routes don't use tenant context — prioritize superadmin_token
  const isSuperAdminRequest = config.url?.includes('/superadmin')
  const token = isSuperAdminRequest
    ? (localStorage.getItem('superadmin_token') || localStorage.getItem('token'))
    : localStorage.getItem('token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  if (isSuperAdminRequest) return config

  // Detect tenant slug from path /r/:tenantSlug or localStorage
  const pathMatch = window.location.pathname.match(/^\/r\/([^\/]+)/)
  const pathSlug = pathMatch ? pathMatch[1] : null
  const storedSlug = localStorage.getItem('tenant_slug')

  const tenantSlug = pathSlug || storedSlug
  if (tenantSlug) {
    config.headers['X-Tenant-Slug'] = tenantSlug
  }

  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized for admin routes without infinite loop
    if (error.response?.status === 401 && window.location.pathname.startsWith('/admin')) {
      localStorage.removeItem('token')
      if (window.location.pathname !== '/admin/login' && window.location.pathname !== '/superadmin/login') {
        window.location.href = '/admin/login'
      }
    }
    return Promise.reject(error)
  }
)
export default client
