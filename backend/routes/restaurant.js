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
    const {
      name, name_am, tagline, description, address, phone,
      wifi_password, working_hours, vat_rate, service_charge_rate,
      currency, logo_url, cover_url,
    } = req.body

    try {
      // Build dynamic SET clauses — only update fields that were actually sent
      const fields = []
      const params = []
      let idx = 1

      const addField = (col, val) => {
        fields.push(`${col}=$${idx}`)
        params.push(val)
        idx++
      }

      if (name              !== undefined) addField('name', name)
      if (name_am           !== undefined) addField('name_am', name_am)
      if (tagline           !== undefined) addField('tagline', tagline)
      if (description       !== undefined) addField('description', description)
      if (address           !== undefined) addField('address', address)
      if (phone             !== undefined) addField('phone', phone)
      if (wifi_password     !== undefined) addField('wifi_password', wifi_password)
      if (working_hours     !== undefined) addField('working_hours', working_hours)
      if (vat_rate          !== undefined) addField('vat_rate', vat_rate)
      if (service_charge_rate !== undefined) addField('service_charge_rate', service_charge_rate)
      if (currency          !== undefined) addField('currency', currency)
      // Always update logo_url and cover_url when explicitly sent (even null/empty)
      if (logo_url  !== undefined) addField('logo_url', logo_url  || null)
      if (cover_url !== undefined) addField('cover_url', cover_url || null)

      fields.push('updated_at=GETDATE()')
      params.push(req.tenantId)

      await query(
        `UPDATE tenants SET ${fields.join(', ')} WHERE id=$${idx}`,
        params
      )

      const result = await query(`SELECT * FROM tenants WHERE id = $1`, [req.tenantId])
      if (result.rows[0]) return res.json(result.rows[0])
    } catch (dbErr) {
      console.warn('DB update failed in PUT /restaurant:', dbErr.message)
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
      ...(logo_url  !== undefined && { logo_url:  logo_url  || null }),
      ...(cover_url !== undefined && { cover_url: cover_url || null }),
    })

    res.json(updated || { id: req.tenantId, name })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

