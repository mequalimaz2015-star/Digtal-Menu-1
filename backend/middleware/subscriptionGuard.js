const { query } = require('../db')

/**
 * Ensures tenant hasn't exceeded their maximum allowed menu items
 */
async function checkMenuItemLimit(req, res, next) {
  try {
    const tenantId = req.tenantId || req.tenant.id
    const maxItems = req.tenant.max_menu_items || 30

    const countRes = await query('SELECT COUNT(*) as count FROM menu_items WHERE tenant_id = $1', [tenantId])
    const currentCount = parseInt(countRes.rows[0].count, 10)

    if (currentCount >= maxItems) {
      return res.status(403).json({
        error: `Subscription plan limit reached: You have reached the maximum of ${maxItems} menu items for your plan. Upgrade your plan to add more.`,
        limit_reached: true,
        max_allowed: maxItems,
        current_count: currentCount
      })
    }

    next()
  } catch (err) {
    console.error('Error checking menu item limit:', err)
    next(err)
  }
}

/**
 * Ensures tenant hasn't exceeded maximum allowed tables
 */
async function checkTableLimit(req, res, next) {
  try {
    const tenantId = req.tenantId || req.tenant.id
    const maxTables = req.tenant.max_tables || 10

    const countRes = await query('SELECT COUNT(*) as count FROM tables WHERE tenant_id = $1', [tenantId])
    const currentCount = parseInt(countRes.rows[0].count, 10)

    if (currentCount >= maxTables) {
      return res.status(403).json({
        error: `Subscription plan limit reached: You have reached the maximum of ${maxTables} tables for your plan. Upgrade your plan to add more.`,
        limit_reached: true,
        max_allowed: maxTables,
        current_count: currentCount
      })
    }

    next()
  } catch (err) {
    console.error('Error checking table limit:', err)
    next(err)
  }
}

/**
 * Checks if delivery feature is enabled in tenant's plan
 */
function requireDeliveryEnabled(req, res, next) {
  if (!req.tenant.delivery_enabled) {
    return res.status(403).json({
      error: 'Delivery orders are not enabled on this restaurant plan. Please upgrade to Pro Plan to enable delivery features.',
      feature_disabled: true
    })
  }
  next()
}

/**
 * Checks staff accounts limit
 */
async function checkStaffLimit(req, res, next) {
  try {
    const tenantId = req.tenantId || req.tenant.id
    const maxStaff = req.tenant.max_staff_accounts || 5

    const countRes = await query("SELECT COUNT(*) as count FROM users WHERE tenant_id = $1 AND role != 'customer'", [tenantId])
    const currentCount = parseInt(countRes.rows[0].count, 10)

    if (currentCount >= maxStaff) {
      return res.status(403).json({
        error: `Subscription plan limit reached: You have reached the maximum of ${maxStaff} staff accounts for your plan. Upgrade your plan to add more staff.`,
        limit_reached: true,
        max_allowed: maxStaff,
        current_count: currentCount
      })
    }

    next()
  } catch (err) {
    console.error('Error checking staff limit:', err)
    next(err)
  }
}

module.exports = {
  checkMenuItemLimit,
  checkTableLimit,
  requireDeliveryEnabled,
  checkStaffLimit
}
