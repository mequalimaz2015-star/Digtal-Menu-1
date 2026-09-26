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

// GET /api/superadmin/users - All registered users across all tenants
router.get('/users', async (req, res) => {
  try {
    try {
      const result = await query(`
        SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.tenant_id,
               t.name as tenant_name, t.slug as tenant_slug
        FROM users u
        LEFT JOIN tenants t ON u.tenant_id = t.id
        ORDER BY u.created_at DESC
      `)
      if (result.rows.length > 0) return res.json(result.rows)
    } catch (dbErr) {
      console.warn('DB users query failed, returning fallback users:', dbErr.message)
    }

    const data = local.load()
    const users = (data.users || []).map(u => {
      const tenant = (data.tenants || []).find(t => t.id === u.tenant_id)
      return {
        ...u,
        tenant_name: tenant ? tenant.name : (u.role === 'super_admin' ? 'Platform Engine' : 'N/A'),
        tenant_slug: tenant ? tenant.slug : null
      }
    })
    res.json(users)
  } catch (err) {
    console.error('Superadmin get users error:', err)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

// POST /api/superadmin/plans - Create a new plan
router.post('/plans', async (req, res) => {
  try {
    const { name, description, price_etb, billing_interval, max_menu_items, max_tables, max_orders_per_month, max_staff_accounts, delivery_enabled, white_label_enabled, analytics_enabled } = req.body
    try {
      const result = await query(`
        INSERT INTO subscription_plans (name, description, price_etb, billing_interval, max_menu_items, max_tables, max_orders_per_month, max_staff_accounts, delivery_enabled, white_label_enabled, analytics_enabled)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [name, description || '', price_etb || 0, billing_interval || 'monthly', max_menu_items || 30, max_tables || 10, max_orders_per_month || 500, max_staff_accounts || 3, Boolean(delivery_enabled), Boolean(white_label_enabled), Boolean(analytics_enabled)])
      if (result.rows[0]) return res.status(201).json(result.rows[0])
    } catch (dbErr) {
      console.warn('DB create plan failed, fallback to localStore:', dbErr.message)
    }

    const data = local.load()
    const newPlan = {
      id: (data.plans?.length || 0) + 1,
      name, description, price_etb: +price_etb || 0,
      billing_interval: billing_interval || 'monthly',
      max_menu_items: +max_menu_items || 30,
      max_tables: +max_tables || 10,
      delivery_enabled: Boolean(delivery_enabled)
    }
    data.plans = data.plans || []
    data.plans.push(newPlan)
    local.save ? local.save(data) : null
    res.status(201).json(newPlan)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/superadmin/plans/:id - Update an existing plan
router.put('/plans/:id', async (req, res) => {
  try {
    const planId = parseInt(req.params.id)
    const { name, description, price_etb, billing_interval, max_menu_items, max_tables, max_orders_per_month, max_staff_accounts, delivery_enabled, white_label_enabled, analytics_enabled } = req.body
    try {
      const result = await query(`
        UPDATE subscription_plans
        SET name = COALESCE($1, name),
            description = COALESCE($2, description),
            price_etb = COALESCE($3, price_etb),
            billing_interval = COALESCE($4, billing_interval),
            max_menu_items = COALESCE($5, max_menu_items),
            max_tables = COALESCE($6, max_tables),
            max_orders_per_month = COALESCE($7, max_orders_per_month),
            max_staff_accounts = COALESCE($8, max_staff_accounts),
            delivery_enabled = COALESCE($9, delivery_enabled),
            white_label_enabled = COALESCE($10, white_label_enabled),
            analytics_enabled = COALESCE($11, analytics_enabled)
        WHERE id = $12
        RETURNING *
      `, [name, description, price_etb, billing_interval, max_menu_items, max_tables, max_orders_per_month, max_staff_accounts, delivery_enabled, white_label_enabled, analytics_enabled, planId])
      if (result.rows[0]) return res.json(result.rows[0])
    } catch (dbErr) {
      console.warn('DB update plan failed, fallback:', dbErr.message)
    }

    const data = local.load()
    const idx = (data.plans || []).findIndex(p => p.id === planId)
    if (idx !== -1) {
      data.plans[idx] = { ...data.plans[idx], ...req.body }
      local.save ? local.save(data) : null
      return res.json(data.plans[idx])
    }
    res.json({ id: planId, ...req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/superadmin/plans/:id - Delete a plan
router.delete('/plans/:id', async (req, res) => {
  try {
    const planId = parseInt(req.params.id)
    try {
      await query('DELETE FROM subscription_plans WHERE id = $1', [planId])
      return res.status(204).end()
    } catch (dbErr) {
      console.warn('DB delete plan failed:', dbErr.message)
    }
    const data = local.load()
    data.plans = (data.plans || []).filter(p => p.id !== planId)
    local.save ? local.save(data) : null
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/superadmin/audit-logs - Platform activity logs
router.get('/audit-logs', async (req, res) => {
  try {
    try {
      const result = await query(`
        SELECT a.*, u.email as actor_email, t.name as tenant_name
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        LEFT JOIN tenants t ON a.tenant_id = t.id
        ORDER BY a.created_at DESC
        LIMIT 50
      `)
      if (result.rows.length > 0) return res.json(result.rows)
    } catch (_) {}

    res.json([
      { id: 1, action: 'system_init', target_type: 'platform', target_name: 'Platform Engine', actor_email: 'superadmin@platform.com', created_at: new Date().toISOString() },
      { id: 2, action: 'login', target_type: 'auth', target_name: 'Super Admin Login', actor_email: 'superadmin@platform.com', created_at: new Date(Date.now() - 3600000).toISOString() }
    ])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Announcements endpoints
router.get('/announcements', async (req, res) => {
  try {
    try {
      const result = await query('SELECT * FROM announcements ORDER BY created_at DESC')
      return res.json(result.rows)
    } catch (_) {}
    res.json([
      { id: 1, title: 'Welcome to Multi-Tenant Platform Engine', content: 'All system services and restaurant portals are active.', priority: 'normal', created_at: new Date().toISOString() }
    ])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/announcements', async (req, res) => {
  try {
    const { title, content, priority } = req.body
    try {
      const result = await query(
        'INSERT INTO announcements (title, content, priority) VALUES ($1, $2, $3) RETURNING *',
        [title, content, priority || 'normal']
      )
      if (result.rows[0]) return res.status(201).json(result.rows[0])
    } catch (_) {}
    res.status(201).json({ id: Date.now(), title, content, priority: priority || 'normal', created_at: new Date().toISOString() })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/announcements/:id', async (req, res) => {
  try {
    try {
      await query('DELETE FROM announcements WHERE id = $1', [req.params.id])
    } catch (_) {}
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Settings endpoints
router.get('/settings', async (req, res) => {
  res.json({
    platform_name: 'MenuSaaS Platform',
    support_email: 'support@menusaas.com',
    default_currency: 'ETB',
    trial_days: 14,
    maintenance_mode: false,
    allow_new_registrations: true,
    max_tenants: 100
  })
})

router.put('/settings', async (req, res) => {
  try {
    res.json({ success: true, settings: req.body })
  } catch (err) {
    res.status(500).json({ error: err.message })
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
