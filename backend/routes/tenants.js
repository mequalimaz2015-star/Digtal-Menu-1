const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { query } = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')
const { resolveTenant, requireTenantMatch } = require('../middleware/tenant')
const local = require('../localStore')
const { sendEmail, welcomeEmailHtml } = require('../emailService')

// GET /api/tenants/public/:slug - Get public restaurant tenant branding & details by slug
router.get('/public/:slug', async (req, res) => {
  try {
    const slug = req.params.slug
    try {
      const result = await query(`
        SELECT t.id, t.name, t.name_am, t.slug, t.tagline, t.description, t.logo_url, 
               t.cover_url, t.address, t.phone, t.wifi_password, t.working_hours, 
               t.vat_rate, t.service_charge_rate, t.currency, t.status,
               p.delivery_enabled, p.white_label_enabled
        FROM tenants t
        LEFT JOIN subscription_plans p ON t.subscription_plan_id = p.id
        WHERE t.slug = $1
      `, [slug])

      if (result.rows.length > 0) {
        const tenant = result.rows[0]
        if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
          return res.status(403).json({ error: 'This restaurant menu is currently unavailable', status: tenant.status })
        }
        return res.json(tenant)
      }
    } catch (dbErr) {
      console.warn('DB read failed in /public/:slug, using localStore:', dbErr.message)
    }

    const localTenant = local.getTenantBySlug(slug)
    if (!localTenant) {
      return res.status(404).json({ error: 'Restaurant not found' })
    }
    if (localTenant.status === 'suspended' || localTenant.status === 'cancelled') {
      return res.status(403).json({ error: 'This restaurant menu is currently unavailable', status: localTenant.status })
    }
    res.json(localTenant)
  } catch (err) {
    console.error('Public tenant info error:', err)
    res.status(500).json({ error: 'Failed to fetch restaurant details' })
  }
})

// POST /api/tenants/register - Restaurant owner self-registration
router.post('/register', async (req, res) => {
  try {
    const { restaurant_name, slug, admin_name, email, phone, password } = req.body

    if (!restaurant_name || !slug || !email || !password) {
      return res.status(400).json({ error: 'Restaurant name, slug, email, and password are required' })
    }

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')

    try {
      const checkSlug = await query('SELECT id FROM tenants WHERE slug = $1', [cleanSlug])
      if (checkSlug.rows.length > 0) {
        return res.status(400).json({ error: 'Restaurant slug already taken. Please choose a different URL slug.' })
      }

      const trialEndsAt = new Date()
      trialEndsAt.setDate(trialEndsAt.getDate() + 14)

      // ── Step 1: insert tenant (no RETURNING — avoids MySQL emulation bugs) ──
      const tenantInsert = await query(`
        INSERT INTO tenants (name, slug, email, phone, status, subscription_plan_id, subscription_status, trial_ends_at)
        VALUES ($1, $2, $3, $4, 'active', 1, 'trialing', $5)
      `, [restaurant_name, cleanSlug, email, phone || null, trialEndsAt])

      // Resolve tenant id via insertId (MySQL) or SELECT fallback
      let tenantId = tenantInsert.insertId ? Number(tenantInsert.insertId) : null
      if (!tenantId) {
        const tr = await query('SELECT id FROM tenants WHERE slug = $1', [cleanSlug])
        tenantId = tr.rows[0] ? Number(tr.rows[0].id) : null
      }
      if (!tenantId) throw new Error('Could not resolve tenant ID after insert')

      // Fetch full tenant row for the response
      const tenantRow = await query('SELECT * FROM tenants WHERE id = $1', [tenantId])
      const tenant = tenantRow.rows[0] || { id: tenantId, name: restaurant_name, slug: cleanSlug }

      const hashedPassword = await bcrypt.hash(password, 10)

      // ── Step 2: insert admin user ─────────────────────────────────────────
      const userInsert = await query(`
        INSERT INTO users (name, email, password, role, tenant_id, is_active)
        VALUES ($1, $2, $3, 'admin', $4, true)
      `, [admin_name || `${restaurant_name} Admin`, email, hashedPassword, tenantId])

      let userId = userInsert.insertId ? Number(userInsert.insertId) : null
      if (!userId) {
        const ur = await query('SELECT id FROM users WHERE LOWER(email) = $1', [email.toLowerCase()])
        userId = ur.rows[0] ? Number(ur.rows[0].id) : null
      }
      if (!userId) throw new Error('Could not resolve user ID after insert')

      // Fetch full user row
      const userRow = await query('SELECT id, name, email, role, tenant_id FROM users WHERE id = $1', [userId])
      const user = userRow.rows[0] || { id: userId, name: admin_name, email, role: 'admin', tenant_id: tenantId }

      // ── Step 3: seed default categories for the new tenant ────────────────
      try {
        await query(`
          INSERT INTO categories (tenant_id, name, name_am, icon, color, sort_order) VALUES
            ($1, 'Breakfast', 'ቁርስ', '🍳', '#f48c06', 0),
            ($1, 'Lunch', 'ምሳ', '🥗', '#2d9d4f', 1),
            ($1, 'Dinner', 'እራት', '🥩', '#8b1a1a', 2),
            ($1, 'Drinks', 'መጠጦች', '🥤', '#2980b9', 3),
            ($1, 'Desserts', 'ጣፋጭ', '🍰', '#e91e8c', 4)
        `, [tenantId])
      } catch (_) {}

      // ── Step 4: seed default tables ────────────────────────────────────────
      try {
        await query(`
          INSERT INTO tables (tenant_id, number, capacity) VALUES
            ($1, '1', 2), ($1, '2', 4), ($1, '3', 4), ($1, '4', 6)
        `, [tenantId])
      } catch (_) {}

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, tenant_id: tenantId, tenant_slug: cleanSlug },
        process.env.JWT_SECRET || 'digital-menu-secret-key-2024-abc-restaurant',
        { expiresIn: '7d' }
      )

      // Send welcome email (fire-and-forget, don't block response)
      sendEmail({
        to:      email,
        subject: `🎉 Welcome to MEGA Digital Menu — ${restaurant_name} is live!`,
        html:    welcomeEmailHtml({ restaurantName: restaurant_name, adminName: admin_name, slug: tenant.slug }),
        text:    `Welcome to MEGA Digital Menu! Your restaurant "${restaurant_name}" is now live at /r/${tenant.slug}/menu`,
      }).catch(() => {})

      return res.status(201).json({
        message: 'Restaurant tenant registered successfully!',
        token,
        user,
        tenant
      })

    } catch (dbErr) {
      console.warn('DB write failed in tenant register, using localStore fallback:', dbErr.message)
    }

    // Fallback registration to localStore when DB is offline
    const hashedPassword = await bcrypt.hash(password, 10)
    const { tenant, user } = local.createTenant({
      name: restaurant_name,
      slug: cleanSlug,
      email,
      phone,
      admin_password: hashedPassword   // store the hash, not raw password
    })

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, tenant_id: tenant.id, tenant_slug: tenant.slug },
      process.env.JWT_SECRET || 'digital-menu-secret-key-2024-abc-restaurant',
      { expiresIn: '7d' }
    )

    return res.status(201).json({
      message: 'Restaurant tenant registered successfully!',
      token,
      user,
      tenant
    })
  } catch (err) {
    console.error('Tenant self-registration error:', err)
    res.status(500).json({ error: 'Registration failed. Please try again.' })
  }
})

// GET /api/tenants/current - Get current tenant profile & subscription info
router.get('/current', requireAuth, resolveTenant, requireTenantMatch, async (req, res) => {
  try {
    try {
      const tenantRes = await query(`
        SELECT t.*, p.name as plan_name, p.price_etb as plan_price, p.max_menu_items,
               p.max_tables, p.max_orders_per_month, p.max_staff_accounts,
               p.delivery_enabled, p.white_label_enabled, p.analytics_enabled,
               (SELECT COUNT(*) FROM menu_items m WHERE m.tenant_id = t.id) as current_menu_items,
               (SELECT COUNT(*) FROM tables tbl WHERE tbl.tenant_id = t.id) as current_tables,
               (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id AND u.role != 'customer') as current_staff
        FROM tenants t
        LEFT JOIN subscription_plans p ON t.subscription_plan_id = p.id
        WHERE t.id = $1
      `, [req.tenantId])

      if (tenantRes.rows.length > 0) return res.json(tenantRes.rows[0])
    } catch (dbErr) {
      console.warn('DB read failed in /tenants/current, using req.tenant:', dbErr.message)
    }

    res.json(req.tenant || local.getTenantBySlug('abc-restaurant'))
  } catch (err) {
    console.error('Get tenant current profile error:', err)
    res.status(500).json({ error: 'Failed to fetch restaurant profile' })
  }
})

// PUT /api/tenants/current - Update restaurant profile settings
router.put('/current', requireAuth, resolveTenant, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    const { name, name_am, tagline, description, logo_url, cover_url, address, phone, email, wifi_password, working_hours, vat_rate, service_charge_rate, currency } = req.body

    try {
      const result = await query(`
        UPDATE tenants
        SET name = COALESCE($1, name),
            name_am = COALESCE($2, name_am),
            tagline = COALESCE($3, tagline),
            description = COALESCE($4, description),
            logo_url = COALESCE($5, logo_url),
            cover_url = COALESCE($6, cover_url),
            address = COALESCE($7, address),
            phone = COALESCE($8, phone),
            email = COALESCE($9, email),
            wifi_password = COALESCE($10, wifi_password),
            working_hours = COALESCE($11, working_hours),
            vat_rate = COALESCE($12, vat_rate),
            service_charge_rate = COALESCE($13, service_charge_rate),
            currency = COALESCE($14, currency),
            updated_at = NOW()
        WHERE id = $15
        RETURNING *
      `, [name, name_am, tagline, description, logo_url, cover_url, address, phone, email, wifi_password, working_hours, vat_rate, service_charge_rate, currency, req.tenantId])

      if (result.rows.length > 0) return res.json(result.rows[0])
    } catch (dbErr) {
      console.warn('DB write failed in PUT /current, returning req.tenant:', dbErr.message)
    }

    res.json({ ...req.tenant, name, phone, address })
  } catch (err) {
    console.error('Update tenant profile error:', err)
    res.status(500).json({ error: 'Failed to update restaurant profile' })
  }
})

// POST /api/tenants/subscription/checkout
router.post('/subscription/checkout', requireAuth, resolveTenant, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    const { plan_id } = req.body
    const plans = local.getPlans()
    const plan = plans.find(p => p.id === Number(plan_id)) || plans[2]

    const tx_ref = `sub-${req.tenantId}-${plan.id}-${Date.now()}`
    const checkout_url = `${req.protocol}://${req.get('host')}/api/tenants/subscription/verify?tx_ref=${tx_ref}&status=success`

    res.json({
      message: 'Subscription payment initiated',
      tx_ref,
      amount: plan.price_etb,
      currency: 'ETB',
      checkout_url
    })
  } catch (err) {
    console.error('Subscription checkout error:', err)
    res.status(500).json({ error: 'Failed to initiate plan upgrade checkout' })
  }
})

// GET /api/tenants/subscription/verify
router.get('/subscription/verify', async (req, res) => {
  try {
    const { tx_ref } = req.query
    return res.redirect(`/admin/settings?payment=success&tx_ref=${tx_ref || 'demo'}`)
  } catch (err) {
    res.status(500).json({ error: 'Payment verification failed' })
  }
})

module.exports = router
