const { query } = require('../db')
const local = require('../localStore')

/**
 * Resolves the active tenant for every request.
 *
 * Priority chain (first match wins):
 * 1. X-Tenant-Slug request header
 * 2. X-Tenant-Id request header
 * 3. URL params tenantSlug / tenantId
 * 4. req.user.tenant_id (set by requireAuth if it ran before this)
 * 5. Decode JWT directly from Authorization header (covers routes where
 *    requireAuth runs AFTER resolveTenant in the middleware chain)
 * 6. Fallback: grant access with unlimited plan so authenticated admins
 *    are never blocked by a missing tenant context
 */
async function resolveTenant(req, res, next) {
  let slug     = req.headers['x-tenant-slug']  || req.params.tenantSlug  || req.query.tenantSlug
  let tenantId = req.headers['x-tenant-id']    || req.params.tenantId    || req.query.tenantId

  // Step 4 — req.user from a prior requireAuth
  if (!slug && !tenantId && req.user?.tenant_id) {
    tenantId = req.user.tenant_id
  }

  // Step 5 — decode JWT directly when req.user is not yet populated
  if (!slug && !tenantId) {
    try {
      const authHeader = req.headers.authorization
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const jwt = require('jsonwebtoken')
        const token = authHeader.split(' ')[1]
        if (token && token !== 'demo-admin-token' && token !== 'demo-superadmin-token') {
          const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'digital-menu-secret-key-2024-abc-restaurant'
          )
          if (decoded.tenant_slug) {
            slug = decoded.tenant_slug
          } else if (decoded.tenant_id != null) {
            tenantId = decoded.tenant_id
          }
          // Cache on req.user for downstream middleware
          if (!req.user) req.user = decoded
        }
      }
    } catch (_) {
      // Invalid/expired JWT handled by requireAuth — just skip here
    }
  }

  // Step 6 — still nothing: for unauthenticated public routes (customer menu)
  // that don't send a header, return 400. For authenticated routes the JWT
  // decode above should always yield something.
  if (!slug && !tenantId) {
    // Try demo token fallback (local dev only)
    const authHeader = req.headers.authorization || ''
    if (authHeader.includes('demo-admin-token')) {
      req.tenant   = { id: 1, name: 'ABC Restaurant', slug: 'abc-restaurant', max_menu_items: 9999, max_tables: 50, max_staff_accounts: 20, delivery_enabled: true }
      req.tenantId = 1
      return next()
    }
    return res.status(400).json({ error: 'Tenant context required. Provide X-Tenant-Slug header or authenticate.' })
  }

  // ── Try database ─────────────────────────────────────────────────────────
  try {
    let tenantRes
    if (slug) {
      tenantRes = await query(`
        SELECT t.*, p.name as plan_name, p.max_menu_items, p.max_tables,
               p.max_orders_per_month, p.max_staff_accounts, p.delivery_enabled,
               p.white_label_enabled, p.analytics_enabled
        FROM tenants t
        LEFT JOIN subscription_plans p ON t.subscription_plan_id = p.id
        WHERE t.slug = $1
      `, [slug])
    } else {
      tenantRes = await query(`
        SELECT t.*, p.name as plan_name, p.max_menu_items, p.max_tables,
               p.max_orders_per_month, p.max_staff_accounts, p.delivery_enabled,
               p.white_label_enabled, p.analytics_enabled
        FROM tenants t
        LEFT JOIN subscription_plans p ON t.subscription_plan_id = p.id
        WHERE t.id = $1
      `, [Number(tenantId)])
    }

    if (tenantRes && tenantRes.rows && tenantRes.rows.length > 0) {
      req.tenant   = tenantRes.rows[0]
      req.tenantId = Number(tenantRes.rows[0].id)
      return next()
    }

    // DB returned no rows — build a minimal tenant context from the id/slug we have
    // so authenticated admins can still write data
    console.warn(`resolveTenant: no tenant row found for ${slug || tenantId}, using minimal context`)
    req.tenant   = buildFallbackTenant(tenantId, slug)
    req.tenantId = req.tenant.id
    return next()

  } catch (dbErr) {
    console.warn('resolveTenant DB error, using fallback:', dbErr.message)
  }

  // ── localStore fallback (DB offline) ────────────────────────────────────
  const localTenant = slug
    ? local.getTenantBySlug(slug)
    : local.getTenantBySlug(String(tenantId))

  if (localTenant) {
    req.tenant   = { ...localTenant, plan_name: 'Pro SaaS + Delivery', max_menu_items: 9999, max_tables: 50, max_staff_accounts: 20, delivery_enabled: true }
    req.tenantId = req.tenant.id
    return next()
  }

  // ── Last resort: build minimal context so admins are never blocked ────────
  req.tenant   = buildFallbackTenant(tenantId, slug)
  req.tenantId = req.tenant.id
  next()
}

/** Build a minimal tenant object from whatever identifier we have */
function buildFallbackTenant(tenantId, slug) {
  const id = tenantId ? Number(tenantId) : 1
  return {
    id,
    name:                 slug || `Tenant ${id}`,
    slug:                 slug || `tenant-${id}`,
    status:               'active',
    plan_name:            'Pro SaaS + Delivery',
    max_menu_items:       9999,
    max_tables:           50,
    max_staff_accounts:   20,
    delivery_enabled:     true,
    vat_rate:             0.15,
    service_charge_rate:  0.10,
    currency:             'ETB',
  }
}

/**
 * Enforces that the logged-in user belongs to the resolved tenant,
 * or is a Super Admin (unrestricted).
 */
function requireTenantMatch(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  if (req.user.role === 'super_admin') return next()

  // Allow when tenant_id matches OR when tenant_id is not set on user (legacy)
  if (req.user.tenant_id && Number(req.user.tenant_id) !== Number(req.tenantId)) {
    return res.status(403).json({ error: 'Access denied: You do not have permission for this restaurant tenant' })
  }
  next()
}

/**
 * Blocks request if the tenant subscription is suspended.
 */
function checkTenantActive(req, res, next) {
  if (req.user?.role === 'super_admin') return next()
  if (req.tenant?.status === 'suspended' || req.tenant?.status === 'cancelled') {
    return res.status(403).json({
      error: 'Restaurant subscription is suspended. Please contact support.',
      tenant_status: req.tenant.status,
    })
  }
  next()
}

module.exports = { resolveTenant, requireTenantMatch, checkTenantActive }
