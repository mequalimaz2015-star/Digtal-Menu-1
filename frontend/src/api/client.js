import axios from 'axios'

// Use environment variable for remote backend, fallback to relative path
const API_URL = import.meta.env.VITE_API_URL || '/api'

const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  // Superadmin routes do not use tenant context
  const isSuperAdminRequest = config.url?.includes('/superadmin')
  const token = isSuperAdminRequest
    ? (localStorage.getItem('superadmin_token') || localStorage.getItem('token'))
    : localStorage.getItem('token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  if (isSuperAdminRequest) return config

  // Resolve tenant slug from (in priority order):
  // 1. URL path  /r/:tenantSlug   (customer-facing multi-tenant routes)
  // 2. sessionStorage 'tenant_slug' (set by customer menu pages)
  // 3. localStorage  'tenant_slug'  (set at admin login)
  // 4. Decoded from the JWT itself  (AletCloud: ensures slug always available)
  const pathMatch = window.location.pathname.match(/^\/r\/([^/]+)/)
  const pathSlug = pathMatch ? pathMatch[1] : null
  const sessionSlug = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('tenant_slug') : null
  const storedSlug  = localStorage.getItem('tenant_slug')

  let tenantSlug = pathSlug || sessionSlug || storedSlug

  if (!tenantSlug && token && token !== 'demo-admin-token') {
    try {
      const parts = token.split('.')
      if (parts.length === 3) {
        const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/')
        const payload = JSON.parse(atob(padded + '=='.slice((padded.length % 4) || 4)))
        if (payload.tenant_slug) {
          tenantSlug = payload.tenant_slug
          localStorage.setItem('tenant_slug', tenantSlug)
        }
      }
    } catch (_) {}
  }

  if (tenantSlug) {
    config.headers['X-Tenant-Slug'] = tenantSlug
  }

  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized for superadmin and admin routes without infinite loop
    if (error.response?.status === 401) {
      if (window.location.pathname.startsWith('/superadmin')) {
        localStorage.removeItem('superadmin_token')
        localStorage.removeItem('superadmin_user')
        localStorage.removeItem('token')
        localStorage.removeItem('admin-user')
        localStorage.removeItem('user')
        if (window.location.pathname !== '/superadmin/login') {
          window.location.href = '/superadmin/login'
        }
      } else if (window.location.pathname.startsWith('/admin')) {
        const slug = localStorage.getItem('tenant_slug') || 'default'
        localStorage.removeItem('token')
        localStorage.removeItem('admin-user')
        localStorage.removeItem('user')
        localStorage.removeItem(`menu-store-${slug}`)
        localStorage.removeItem('menu-store')
        localStorage.removeItem(`restaurant-store-${slug}`)
        localStorage.removeItem('restaurant-store')
        localStorage.removeItem('tenant_slug')
        if (window.location.pathname !== '/admin/login') {
          window.location.href = '/admin/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

export default client
