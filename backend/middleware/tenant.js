const { query } = require('../db')
const local = require('../localStore')

/**
 * Middleware to resolve the active tenant for the request.
 * Checks header X-Tenant-Slug, URL param tenantSlug/tenantId, query param, or req.user.tenant_id.
 * Fallback to localStore when DB is offline.
 */
async function resolveTenant(req, res, next) {
  let slug = req.headers['x-tenant-slug'] || req.params.tenantSlug || req.query.tenantSlug
  let tenantId = req.headers['x-tenant-id'] || req.params.tenantId || req.query.tenantId

  // JWT-based fallback: use the authenticated user's own tenant
  if (!slug && !tenantId && req.user && req.user.tenant_id) {
    tenantId = req.user.tenant_id
  }

  // If still nothing — and no authenticated user — reject rather than silently
  // defaulting to ABC Restaurant (tenant id=1) which would leak data.
  if (!slug && !tenantId) {
    return res.status(400).json({ error: 'Tenant context required. Provide X-Tenant-Slug header or authenticate.' })
  }

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
      `, [tenantId])
    }

    if (tenantRes.rows && tenantRes.rows.length > 0) {
      req.tenant = tenantRes.rows[0]
      req.tenantId = tenantRes.rows[0].id
      return next()
    }
  } catch (err) {
    console.warn('DB unavailable in resolveTenant, using localStore fallback:', err.message)
  }

  // DB offline fallback — resolve from localStore using the exact slug/id provided,
  // never defaulting to 'abc-restaurant' when a real identifier was given.
  const localTenant = slug
    ? local.getTenantBySlug(slug)
    : local.getTenantBySlug(String(tenantId))

  if (!localTenant) {
    return res.status(404).json({ error: 'Restaurant not found' })
  }

  req.tenant = {
    ...localTenant,
    plan_name: 'Pro SaaS + Delivery',
    max_menu_items: 9999,
    max_tables: 50,
    max_staff_accounts: 20,
    delivery_enabled: true
  }
  req.tenantId = req.tenant.id

  next()
}

/**
 * Enforces that user belongs to the requested tenant or is Super Admin
 */
function requireTenantMatch(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  // Super Admin can access any tenant
  if (req.user.role === 'super_admin') {
    return next()
  }

  if (req.user.tenant_id && req.user.tenant_id !== req.tenantId) {
    return res.status(403).json({ error: 'Access denied: You do not have permission for this restaurant tenant' })
  }

  next()
}

/**
 * Rejects request if tenant subscription is suspended
 */
function checkTenantActive(req, res, next) {
  if (req.user && req.user.role === 'super_admin') {
    return next()
  }

  if (req.tenant && (req.tenant.status === 'suspended' || req.tenant.status === 'cancelled')) {
    return res.status(403).json({ 
      error: 'Restaurant subscription is temporarily suspended or inactive. Please contact support to restore access.',
      tenant_status: req.tenant.status 
    })
  }

  next()
}

module.exports = {
  resolveTenant,
  requireTenantMatch,
  checkTenantActive
}
