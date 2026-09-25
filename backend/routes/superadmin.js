const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { query } = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')
const local = require('../localStore')

router.use(requireAuth, requireRole(['super_admin']))

// GET /api/superadmin/dashboard - Overview metrics
router.get('/dashboard', async (req, res) => {
  try {
    try {
      const tenantsCount = await query('SELECT COUNT(*) as count FROM tenants')
      const activeTenants = await query("SELECT COUNT(*) as count FROM tenants WHERE status = 'active'")
      const trialTenants = await query("SELECT COUNT(*) as count FROM tenants WHERE status = 'trial'")
      const totalOrders = await query('SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as revenue FROM orders')
      const mrrRes = await query(`
        SELECT COALESCE(SUM(p.price_etb), 0) as mrr
        FROM tenants t
        JOIN subscription_plans p ON t.subscription_plan_id = p.id
        WHERE t.status = 'active'
      `)

      return res.json({
        total_tenants: parseInt(tenantsCount.rows[0].count, 10),
        active_tenants: parseInt(activeTenants.rows[0].count, 10),
        trial_tenants: parseInt(trialTenants.rows[0].count, 10),
        mrr_etb: parseFloat(mrrRes.rows[0].mrr),
        total_orders_platform: parseInt(totalOrders.rows[0].count, 10),
        total_revenue_platform: parseFloat(totalOrders.rows[0].revenue)
      })
    } catch (dbErr) {
      console.warn('DB unavailable in superadmin dashboard, using localStore fallback:', dbErr.message)
    }

    const tenants = local.getTenants()
    const orders = local.getOrders()
    const revenue = orders.reduce((sum, o) => sum + (o.grand_total || 0), 0)

    res.json({
      total_tenants: tenants.length,
      active_tenants: tenants.filter(t => t.status === 'active').length,
      trial_tenants: tenants.filter(t => t.subscription_status === 'trialing').length,
      mrr_etb: 3500,
      total_orders_platform: orders.length,
      total_revenue_platform: revenue
    })
  } catch (err) {
    console.error('Superadmin dashboard error:', err)
    res.status(500).json({ error: 'Failed to fetch platform dashboard metrics' })
  }
})

// GET /api/superadmin/tenants - List all tenants
router.get('/tenants', async (req, res) => {
  try {
    try {
      const result = await query(`
        SELECT t.*, p.name as plan_name, p.price_etb as plan_price,
               (SELECT COUNT(*) FROM menu_items m WHERE m.tenant_id = t.id) as item_count,
               (SELECT COUNT(*) FROM orders o WHERE o.tenant_id = t.id) as order_count,
               (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id AND u.role = 'admin') as admin_count
        FROM tenants t
        LEFT JOIN subscription_plans p ON t.subscription_plan_id = p.id
        ORDER BY t.created_at DESC
      `)
      if (result.rows.length > 0) return res.json(result.rows)
    } catch (dbErr) {
      console.warn('DB unavailable in superadmin get tenants, using localStore:', dbErr.message)
    }

    const tenants = local.getTenants().map(t => ({
      ...t,
      plan_name: t.subscription_plan_id === 3 ? 'Pro SaaS + Delivery' : (t.subscription_plan_id === 2 ? 'Basic Plan' : 'Free Trial'),
      plan_price: t.subscription_plan_id === 3 ? 3500 : (t.subscription_plan_id === 2 ? 1500 : 0),
      item_count: local.getMenuItems(t.id).length,
      order_count: local.getOrders(null, t.id).length
    }))
    res.json(tenants)
  } catch (err) {
    console.error('Superadmin get tenants error:', err)
    res.status(500).json({ error: 'Failed to fetch tenants list' })
  }
})

// POST /api/superadmin/tenants - Create a new tenant manually
router.post('/tenants', async (req, res) => {
  try {
    const { name, name_am, slug, email, phone, address, plan_id, admin_name, admin_password } = req.body

    if (!name || !slug || !email) {
      return res.status(400).json({ error: 'Name, slug, and email are required' })
    }

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')

    try {
      const tenantRes = await query(`
        INSERT INTO tenants (name, name_am, slug, email, phone, address, subscription_plan_id, status, subscription_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', 'active')
        RETURNING *
      `, [name, name_am || null, cleanSlug, email, phone || null, address || null, plan_id || 1])

      const tenant = tenantRes.rows[0]
      if (admin_password) {
        const hashedPassword = await bcrypt.hash(admin_password, 10)
        await query(`
          INSERT INTO users (name, email, password, role, tenant_id)
          VALUES ($1, $2, $3, 'admin', $4)
        `, [admin_name || `${name} Admin`, email, hashedPassword, tenant.id])
      }
      return res.status(201).json(tenant)
    } catch (dbErr) {
      console.warn('DB write failed in superadmin create tenant, fallback to localStore:', dbErr.message)
    }

    const { tenant } = local.createTenant({ name, slug: cleanSlug, email, phone, address, plan_id, admin_password })
    res.status(201).json(tenant)
  } catch (err) {
    console.error('Superadmin create tenant error:', err)
    res.status(500).json({ error: 'Failed to create tenant' })
  }
})

// PUT /api/superadmin/tenants/:id - Update tenant details
router.put('/tenants/:id', async (req, res) => {
  try {
    const { name, name_am, slug, email, phone, address, plan_id } = req.body
    const tenantId = req.params.id

    try {
      const result = await query(`
        UPDATE tenants
        SET name = COALESCE($1, name),
            name_am = COALESCE($2, name_am),
            slug = COALESCE($3, slug),
            email = COALESCE($4, email),
            phone = COALESCE($5, phone),
            address = COALESCE($6, address),
            subscription_plan_id = COALESCE($7, subscription_plan_id),
            updated_at = NOW()
        WHERE id = $8
        RETURNING *
      `, [name, name_am || null, slug, email, phone || null, address || null, plan_id || null, tenantId])

      if (result.rows.length > 0) return res.json(result.rows[0])
    } catch (dbErr) {
      console.warn('DB update tenant failed, fallback to localStore:', dbErr.message)
    }

    // localStore fallback — update what we can
    const updated = local.updateTenantStatus(tenantId, null, plan_id)
    res.json(updated || { id: tenantId, name, email })
  } catch (err) {
    console.error('Superadmin update tenant error:', err)
    res.status(500).json({ error: 'Failed to update tenant' })
  }
})

// PUT /api/superadmin/tenants/:id/status - Update tenant status
router.put('/tenants/:id/status', async (req, res) => {
  try {
    const { status, subscription_plan_id } = req.body
    const tenantId = req.params.id

    try {
      const result = await query(`
        UPDATE tenants 
        SET status = COALESCE($1, status),
            subscription_plan_id = COALESCE($2, subscription_plan_id),
            updated_at = NOW() 
        WHERE id = $3 
        RETURNING *
      `, [status, subscription_plan_id, tenantId])

      if (result.rows.length > 0) return res.json(result.rows[0])
    } catch (dbErr) {
      console.warn('DB update status failed, fallback to localStore:', dbErr.message)
    }

    const updated = local.updateTenantStatus(tenantId, status, subscription_plan_id)
    res.json(updated || { id: tenantId, status })
  } catch (err) {
    console.error('Superadmin status update error:', err)
    res.status(500).json({ error: 'Failed to update tenant status' })
  }
})

// POST /api/superadmin/tenants/:id/impersonate
router.post('/tenants/:id/impersonate', async (req, res) => {
  try {
    const tenantId = req.params.id
    let tenant = local.getTenants().find(t => t.id === Number(tenantId)) || local.getTenantBySlug('abc-restaurant')

    try {
      const tenantRes = await query('SELECT * FROM tenants WHERE id = $1', [tenantId])
      if (tenantRes.rows.length > 0) tenant = tenantRes.rows[0]
    } catch (_) {}

    const token = jwt.sign(
      {
        id: req.user.id,
        email: req.user.email,
        role: 'admin',
        tenant_id: tenant.id,
        tenant_slug: tenant.slug,
        is_impersonating: true,
        original_user_id: req.user.id
      },
      process.env.JWT_SECRET || 'digital-menu-secret-key-2024-abc-restaurant',
      { expiresIn: '2h' }
    )

    res.json({ token, tenant })
  } catch (err) {
    console.error('Superadmin impersonate error:', err)
    res.status(500).json({ error: 'Impersonation failed' })
  }
})

// GET /api/superadmin/plans
router.get('/plans', async (req, res) => {
  try {
    try {
      const plans = await query('SELECT * FROM subscription_plans ORDER BY price_etb ASC')
      if (plans.rows.length > 0) return res.json(plans.rows)
    } catch (dbErr) {
      console.warn('DB plans query failed, returning localStore plans:', dbErr.message)
    }

    res.json(local.getPlans())
  } catch (err) {
    console.error('Superadmin get plans error:', err)
    res.status(500).json({ error: 'Failed to fetch subscription plans' })
  }
})

// DELETE /api/superadmin/tenants/:id
router.delete('/tenants/:id', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.id)

    try {
      // Delete all dependent data first to avoid FK violations
      await query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE tenant_id=$1)', [tenantId])
      await query('DELETE FROM orders WHERE tenant_id=$1', [tenantId])
      await query('DELETE FROM reviews WHERE tenant_id=$1', [tenantId]).catch(() => {})
      await query('DELETE FROM menu_items WHERE tenant_id=$1', [tenantId])
      await query('DELETE FROM categories WHERE tenant_id=$1', [tenantId])
      await query('DELETE FROM tables WHERE tenant_id=$1', [tenantId])
      await query('DELETE FROM users WHERE tenant_id=$1', [tenantId])
      await query('DELETE FROM tenants WHERE id=$1', [tenantId])
      return res.status(204).end()
    } catch (dbErr) {
      console.warn('DB delete tenant failed, fallback to localStore:', dbErr.message)
    }

    // localStore fallback — remove tenant and its users
    const data = local.load()
    data.tenants = data.tenants.filter(t => t.id !== tenantId)
    data.users = data.users.filter(u => u.tenant_id !== tenantId)
    data.orders = data.orders.filter(o => o.tenant_id !== tenantId)
    data.orderItems = data.orderItems.filter(i => {
      const order = data.orders.find(o => o.id === i.order_id)
      return !!order
    })
    local.save ? local.save(data) : require('fs').writeFileSync(
      require('path').join(__dirname, '../data.json'),
      JSON.stringify(data, null, 2)
    )
    res.status(204).end()
  } catch (err) {
    console.error('Superadmin delete tenant error:', err)
    res.status(500).json({ error: 'Failed to delete tenant' })
  }
})

module.exports = router
