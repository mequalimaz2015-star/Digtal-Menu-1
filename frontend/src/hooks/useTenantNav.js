/**
 * useTenantNav — tenant-aware navigation hook
 *
 * Reads the :tenantSlug param from the current URL (if present) and
 * returns a `tNavigate` helper that automatically prepends the
 * /r/:tenantSlug prefix so every customer-facing navigate() call
 * stays within the same restaurant.
 *
 * Usage:
 *   const { tNavigate, tenantPrefix } = useTenantNav()
 *   tNavigate('/menu')          // → /r/finshiline/menu  (or /menu for default)
 *   tNavigate('/cart')          // → /r/finshiline/cart
 *   tNavigate(`/order-confirmation/${id}`)  // → /r/finshiline/order-confirmation/...
 */
import { useNavigate, useParams } from 'react-router-dom'

export function useTenantNav() {
  const navigate = useNavigate()
  const params   = useParams()

  // Try URL param first, then fall back to sessionStorage (set by HomePage)
  const tenantSlug =
    params.tenantSlug ||
    (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('tenant_slug') : null) ||
    null

  // Only build prefix for multi-tenant slugs (skip the default 'abc-restaurant')
  const isMultiTenant = tenantSlug && tenantSlug !== 'abc-restaurant'
  const tenantPrefix  = isMultiTenant ? `/r/${tenantSlug}` : ''

  /**
   * Navigate to a customer page, keeping the tenant prefix.
   * @param {string} path  — must start with '/', e.g. '/menu', '/cart'
   * @param {object} opts  — optional react-router navigate options (replace, state…)
   */
  const tNavigate = (path, opts) => {
    navigate(`${tenantPrefix}${path}`, opts)
  }

  return { tNavigate, tenantPrefix, tenantSlug }
}
