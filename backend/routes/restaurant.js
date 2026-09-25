const router = require('express').Router()
const { query } = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')
const { resolveTenant, requireTenantMatch } = require('../middleware/tenant')
const local = require('../localStore')

router.use(resolveTenant)

// GET /api/restaurant
router.get('/', async (req, res) => {
  try {
    try {
      const result = await query(`
        SELECT t.*, p.delivery_enabled, p.white_label_enabled
        FROM tenants t
        LEFT JOIN subscription_plans p ON t.subscription_plan_id = p.id
        WHERE t.id = $1
      `, [req.tenantId])
      if (result.rows[0]) return res.json(result.rows[0])
    } catch (dbErr) {
      console.warn('DB unavailable in GET /restaurant, using localStore:', dbErr.message)
    }

    // DB offline fallback — req.tenant is already populated by resolveTenant
    // which itself fell back to localStore, so just return it directly
    const localTenant = req.tenant || local.getTenantBySlug(String(req.tenantId))
    if (!localTenant) return res.status(404).json({ error: 'Restaurant not found' })
    return res.json(localTenant)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/restaurant
router.put('/', requireAuth, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    const { name, name_am, tagline, description, address, phone, wifi_password, working_hours, vat_rate, service_charge_rate, currency } = req.body

    try {
      await query(`
        UPDATE tenants SET
          name=COALESCE($1, name), name_am=COALESCE($2, name_am), tagline=COALESCE($3, tagline), 
          description=COALESCE($4, description), address=COALESCE($5, address), phone=COALESCE($6, phone),
          wifi_password=COALESCE($7, wifi_password), working_hours=COALESCE($8, working_hours), 
          vat_rate=COALESCE($9, vat_rate), service_charge_rate=COALESCE($10, service_charge_rate), 
          currency=COALESCE($11, currency), updated_at=NOW()
        WHERE id=$12
      `, [name, name_am, tagline, description, address, phone, wifi_password, working_hours, vat_rate, service_charge_rate, currency, req.tenantId])

      const result = await query(`SELECT * FROM tenants WHERE id = $1`, [req.tenantId])
      if (result.rows[0]) return res.json(result.rows[0])
    } catch (dbErr) {
      console.warn('DB update failed in PUT /restaurant, using localStore:', dbErr.message)
    }

    const updated = local.updateTenant(req.tenantId, {
      ...(name !== undefined && { name }),
      ...(name_am !== undefined && { name_am }),
      ...(tagline !== undefined && { tagline }),
      ...(description !== undefined && { description }),
      ...(address !== undefined && { address }),
      ...(phone !== undefined && { phone }),
      ...(wifi_password !== undefined && { wifi_password }),
      ...(working_hours !== undefined && { working_hours }),
      ...(vat_rate !== undefined && { vat_rate }),
      ...(service_charge_rate !== undefined && { service_charge_rate }),
      ...(currency !== undefined && { currency }),
    })

    res.json(updated || { id: req.tenantId, name })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

