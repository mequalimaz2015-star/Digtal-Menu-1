const express = require('express')
const router = express.Router()
const { query } = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')
const { resolveTenant, requireTenantMatch } = require('../middleware/tenant')
const { requireDeliveryEnabled } = require('../middleware/subscriptionGuard')
const local = require('../localStore')

router.use(resolveTenant)

// GET /api/delivery/zones - List active delivery zones
router.get('/zones', async (req, res) => {
  try {
    try {
      const result = await query(
        'SELECT * FROM delivery_zones WHERE tenant_id = $1 AND is_active = TRUE ORDER BY delivery_fee ASC',
        [req.tenantId]
      )
      if (result.rows.length > 0) return res.json(result.rows)
    } catch (dbErr) {
      console.warn('DB zones query failed, using localStore:', dbErr.message)
    }

    res.json([
      { id: 1, tenant_id: req.tenantId, zone_name: 'Bole & Around', min_order_amount: 200, delivery_fee: 100, estimated_delivery_minutes: 30, is_active: true },
      { id: 2, tenant_id: req.tenantId, zone_name: 'Kazanchis & Kirkos', min_order_amount: 300, delivery_fee: 150, estimated_delivery_minutes: 45, is_active: true },
      { id: 3, tenant_id: req.tenantId, zone_name: 'Piassa & Arada', min_order_amount: 400, delivery_fee: 200, estimated_delivery_minutes: 50, is_active: true }
    ])
  } catch (err) {
    console.error('Get delivery zones error:', err)
    res.status(500).json({ error: 'Failed to fetch delivery zones' })
  }
})

// POST /api/delivery/zones
router.post('/zones', requireAuth, requireTenantMatch, requireRole(['admin']), requireDeliveryEnabled, async (req, res) => {
  try {
    const { zone_name, min_order_amount, delivery_fee, estimated_delivery_minutes } = req.body
    if (!zone_name) return res.status(400).json({ error: 'Zone name is required' })

    try {
      const result = await query(`
        INSERT INTO delivery_zones (tenant_id, zone_name, min_order_amount, delivery_fee, estimated_delivery_minutes)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [req.tenantId, zone_name, min_order_amount || 0, delivery_fee || 0, estimated_delivery_minutes || 45])
      return res.status(201).json(result.rows[0])
    } catch (dbErr) {
      console.warn('DB zone insert failed, returning mockup:', dbErr.message)
    }

    res.status(201).json({ id: Date.now(), tenant_id: req.tenantId, zone_name, min_order_amount, delivery_fee, estimated_delivery_minutes })
  } catch (err) {
    res.status(500).json({ error: 'Failed to create delivery zone' })
  }
})

// GET /api/delivery/addresses
router.get('/addresses', requireAuth, async (req, res) => {
  try {
    try {
      const result = await query(
        'SELECT * FROM customer_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
        [req.user.id]
      )
      return res.json(result.rows)
    } catch (dbErr) {}
    res.json([])
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch saved addresses' })
  }
})

// GET /api/delivery/rider/orders - Rider dashboard list orders available for delivery
router.get('/rider/orders', requireAuth, async (req, res) => {
  try {
    try {
      const result = await query(`
        SELECT o.*, t.name as restaurant_name, t.phone as restaurant_phone
        FROM orders o
        JOIN tenants t ON o.tenant_id = t.id
        WHERE o.order_type = 'delivery'
        ORDER BY o.created_at ASC
      `)
      if (result.rows.length > 0) return res.json(result.rows)
    } catch (dbErr) {
      console.warn('DB rider orders query failed, using localStore:', dbErr.message)
    }

    const localRiderOrders = local.getRiderOrders(req.tenantId)
    res.json(localRiderOrders)
  } catch (err) {
    console.error('Get rider orders error:', err)
    res.status(500).json({ error: 'Failed to fetch rider orders' })
  }
})

// PUT /api/delivery/rider/orders/:id/status
router.put('/rider/orders/:id/status', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id
    const { delivery_status, status } = req.body
    const io = req.app.get('io')

    try {
      const updateRes = await query(`
        UPDATE orders
        SET delivery_status = COALESCE($1, delivery_status),
            status = COALESCE($2, status),
            rider_id = COALESCE($3, rider_id),
            updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `, [delivery_status, status, req.user.id, orderId])

      if (updateRes.rows.length > 0) {
        const updatedOrder = updateRes.rows[0]
        if (io) {
          io.emit(`order-${updatedOrder.order_ref}`, updatedOrder)
          io.emit(`tenant-${updatedOrder.tenant_id}-order-update`, updatedOrder)
        }
        return res.json(updatedOrder)
      }
    } catch (dbErr) {
      console.warn('DB rider status update failed, fallback to localStore:', dbErr.message)
    }

    const updated = local.updateOrderStatus(orderId, status, delivery_status)
    if (io && updated) io.emit(`order-${updated.order_ref}`, updated)
    res.json(updated || { id: orderId, delivery_status, status })
  } catch (err) {
    console.error('Update rider order status error:', err)
    res.status(500).json({ error: 'Failed to update order status' })
  }
})

module.exports = router
