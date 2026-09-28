const { query } = require('../db')
const local = require('../localStore')

// Helper: count items for a tenant — tries DB first, falls back to localStore seed counts
async function countRows(sql, tenantId, localFallback) {
  try {
    const res = await query(sql, [tenantId])
    return parseInt(res.rows[0]?.count ?? res.rows[0]?.cnt ?? 0, 10)
  } catch (_) {
    // DB offline — use localStore / seed data count as fallback
    return localFallback(tenantId)
  }
}

/**
 * Ensures tenant hasn't exceeded their maximum allowed menu items.
 * Falls back to localStore seed count when DB is unavailable.
 */
async function checkMenuItemLimit(req, res, next) {
  try {
    const tenantId = req.tenantId || req.tenant?.id
    const maxItems = req.tenant?.max_menu_items ?? 9999  // default unlimited when no plan info

    const count = await countRows(
      'SELECT COUNT(*) as count FROM menu_items WHERE tenant_id = $1',
      tenantId,
      (tid) => local.getSeedMenuItems(tid).length
    )

    if (count >= maxItems) {
      return res.status(403).json({
        error: `Plan limit: maximum ${maxItems} menu items reached. Upgrade to add more.`,
        limit_reached: true,
        max_allowed: maxItems,
        current_count: count,
      })
    }
    next()
  } catch (err) {
    // If limit check itself errors, allow the operation — don't block saves
    console.warn('checkMenuItemLimit error (allowing):', err.message)
    next()
  }
}

/**
 * Ensures tenant hasn't exceeded maximum allowed tables.
 * Falls back to localStore seed count when DB is unavailable.
 */
async function checkTableLimit(req, res, next) {
  try {
    const tenantId = req.tenantId || req.tenant?.id
    const maxTables = req.tenant?.max_tables ?? 9999

    const count = await countRows(
      'SELECT COUNT(*) as count FROM tables WHERE tenant_id = $1',
      tenantId,
      (tid) => local.getSeedTables(tid).length
    )

    if (count >= maxTables) {
      return res.status(403).json({
        error: `Plan limit: maximum ${maxTables} tables reached. Upgrade to add more.`,
        limit_reached: true,
        max_allowed: maxTables,
        current_count: count,
      })
    }
    next()
  } catch (err) {
    console.warn('checkTableLimit error (allowing):', err.message)
    next()
  }
}

/**
 * Checks if delivery feature is enabled in tenant's plan.
 */
function requireDeliveryEnabled(req, res, next) {
  if (req.tenant && req.tenant.delivery_enabled === false) {
    return res.status(403).json({
      error: 'Delivery is not enabled on your plan. Upgrade to Pro to enable delivery.',
      feature_disabled: true,
    })
  }
  next()
}

/**
 * Checks staff accounts limit.
 * Falls back gracefully when DB is unavailable.
 */
async function checkStaffLimit(req, res, next) {
  try {
    const tenantId = req.tenantId || req.tenant?.id
    const maxStaff = req.tenant?.max_staff_accounts ?? 9999

    const count = await countRows(
      "SELECT COUNT(*) as count FROM users WHERE tenant_id = $1 AND role != 'customer'",
      tenantId,
      () => 1  // localStore fallback — assume at least 1 admin exists
    )

    if (count >= maxStaff) {
      return res.status(403).json({
        error: `Plan limit: maximum ${maxStaff} staff accounts reached. Upgrade to add more.`,
        limit_reached: true,
        max_allowed: maxStaff,
        current_count: count,
      })
    }
    next()
  } catch (err) {
    console.warn('checkStaffLimit error (allowing):', err.message)
    next()
  }
}

module.exports = {
  checkMenuItemLimit,
  checkTableLimit,
  requireDeliveryEnabled,
  checkStaffLimit,
}
