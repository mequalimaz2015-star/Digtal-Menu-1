const router = require('express').Router()
const { query } = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')
const { resolveTenant, requireTenantMatch } = require('../middleware/tenant')
const local = require('../localStore')

router.use(resolveTenant)

// Track DB connectivity — only reset on actual connection failures, not query errors
let dbAvailable = null

async function checkDb() {
  if (dbAvailable === true) return true
  try {
    await query('SELECT 1')
    dbAvailable = true
    return true
  } catch (_) {
    dbAvailable = false
    return false
  }
}

function isConnError(err) {
  const msg = (err?.message || '').toLowerCase()
  return msg.includes('connect') || msg.includes('econnrefused') || msg.includes('offline') || msg.includes('not configured')
}

// Re-probe every 30s
setInterval(() => { dbAvailable = null }, 30000)

// ── POST /api/orders ──────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      tableNumber, customerName, phone, notes, items, subtotal, vat, serviceCharge,
      grandTotal, estimatedTime, orderType, pickupTime, deliveryAddress, deliveryLat,
      deliveryLng, deliveryFee, deliveryZoneId, paymentMethod
    } = req.body

    if (!items || !items.length) return res.status(400).json({ error: 'Items required' })

    const orderRef       = `ORD-${Date.now()}`
    const validTypes     = ['dine_in', 'takeaway', 'delivery']
    const resolvedType   = validTypes.includes(orderType) ? orderType : 'dine_in'

    // Generate pickup number for takeaway
    let pickupNumber = null
    if (resolvedType === 'takeaway') {
      try {
        if (await checkDb()) {
          // CURDATE() works on MySQL; for PostgreSQL use CURRENT_DATE — db.js toMySQL strips ::casts
          const cr = await query(
            `SELECT COUNT(*) AS cnt FROM orders WHERE tenant_id=$1 AND order_type='takeaway' AND created_at >= CURDATE()`,
            [req.tenantId]
          )
          pickupNumber = `T-${String((parseInt(cr.rows[0]?.cnt) || 0) + 1).padStart(3, '0')}`
        }
      } catch (_) {}
      if (!pickupNumber) pickupNumber = `T-${Date.now().toString().slice(-3)}`
    }

    if (await checkDb()) {
      try {
        const orderResult = await query(`
          INSERT INTO orders (
            tenant_id, order_ref, table_number, customer_name, phone, notes, subtotal,
            vat, service_charge, grand_total, estimated_time, order_type, pickup_number,
            pickup_time, delivery_address, delivery_lat, delivery_lng, delivery_fee,
            delivery_zone_id, payment_method, payment_status, delivery_status
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
          RETURNING *
        `, [
          req.tenantId,
          orderRef,
          resolvedType === 'dine_in' ? (tableNumber || '') : (resolvedType === 'delivery' ? 'Delivery' : 'Takeaway'),
          customerName || '',
          phone || '',
          notes || '',
          parseFloat(subtotal) || 0,
          parseFloat(vat) || 0,
          parseFloat(serviceCharge) || 0,
          parseFloat(grandTotal) || 0,
          parseInt(estimatedTime) || 20,
          resolvedType,
          pickupNumber || '',
          pickupTime || '',
          deliveryAddress || '',
          parseFloat(deliveryLat) || null,
          parseFloat(deliveryLng) || null,
          parseFloat(deliveryFee) || 0,
          deliveryZoneId ? parseInt(deliveryZoneId) : null,
          paymentMethod || 'cash',
          'pending',
          resolvedType === 'delivery' ? 'pending' : 'pending',
        ])
        const order = orderResult.rows[0]

        for (const item of items) {
          await query(`
            INSERT INTO order_items
              (order_id, menu_item_name, price, quantity, modifiers, special_instructions, item_total)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
          `, [
            order.id,
            item.name || '',
            parseFloat(item.price) || 0,
            parseInt(item.qty) || 1,
            item.modifiers || '',
            item.specialInstructions || '',
            (parseFloat(item.price) || 0) * (parseInt(item.qty) || 1),
          ])
        }

        const ir = await query(`SELECT * FROM order_items WHERE order_id=$1`, [order.id])
        const finalOrder = { ...order, items: ir.rows }

        if (resolvedType === 'dine_in' && tableNumber) {
          query(`UPDATE tables SET status='occupied' WHERE number=$1 AND tenant_id=$2`, [String(tableNumber), req.tenantId]).catch(() => {})
        }

        const io = req.app.get('io')
        if (io) {
          io.emit('new_order', finalOrder)
          io.emit(`tenant-${req.tenantId}-new-order`, finalOrder)
        }

        return res.status(201).json(finalOrder)
      } catch (dbErr) {
        console.warn('DB write failed in POST /orders, falling back:', dbErr.message)
        if (isConnError(dbErr)) dbAvailable = false
      }
    }

    // localStore fallback
    const localOrder = local.createOrder({
      orderRef, tenantId: req.tenantId,
      tableNumber: resolvedType === 'dine_in' ? tableNumber : resolvedType,
      customerName, phone, notes, subtotal, vat, serviceCharge, grandTotal,
      estimatedTime, orderType: resolvedType, pickupNumber, pickupTime,
      deliveryAddress, deliveryLat, deliveryLng,
    })
    for (const item of items) {
      local.addOrderItem({ orderId: localOrder.id, name: item.name, price: item.price, qty: item.qty, modifiers: item.modifiers, specialInstructions: item.specialInstructions })
    }
    const io = req.app.get('io')
    if (io) io.emit('new_order', localOrder)
    return res.status(201).json(local.getOrderById(localOrder.id))

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/orders ───────────────────────────────────────────────────────────
router.get('/', requireAuth, requireTenantMatch, async (req, res) => {
  try {
    const { status, type } = req.query

    if (await checkDb()) {
      try {
        let sql    = `SELECT * FROM orders WHERE tenant_id = $1`
        const params = [req.tenantId]
        let idx    = 2

        if (status) { sql += ` AND status=$${idx++}`;     params.push(status) }
        if (type)   { sql += ` AND order_type=$${idx++}`; params.push(type)   }
        sql += ` ORDER BY created_at DESC`

        const ordersResult = await query(sql, params)
        const orders = ordersResult.rows

        // Attach items — fetch one-by-one to avoid MySQL IN ($1,$2) array issues
        for (const o of orders) {
          try {
            const ir = await query(`SELECT * FROM order_items WHERE order_id=$1`, [o.id])
            o.items = ir.rows
          } catch (_) { o.items = [] }
        }

        return res.json(orders)
      } catch (dbErr) {
        console.warn('DB read failed in GET /orders:', dbErr.message)
        if (isConnError(dbErr)) dbAvailable = false
        // Fall through to localStore
      }
    }

    return res.json(local.getOrders(status, req.tenantId))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/orders/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    if (await checkDb()) {
      try {
        const idVal     = parseInt(req.params.id) || 0
        const ordResult = await query(
          `SELECT * FROM orders WHERE tenant_id=$1 AND (id=$2 OR order_ref=$3)`,
          [req.tenantId, idVal, req.params.id]
        )
        if (ordResult.rows[0]) {
          const order = ordResult.rows[0]
          const ir    = await query(`SELECT * FROM order_items WHERE order_id=$1`, [order.id])
          return res.json({ ...order, items: ir.rows })
        }
      } catch (dbErr) {
        if (isConnError(dbErr)) dbAvailable = false
      }
    }

    const order = local.getOrderById(req.params.id)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    return res.json(order)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PUT /api/orders/:id/status ────────────────────────────────────────────────
router.put('/:id/status', requireAuth, requireTenantMatch, async (req, res) => {
  try {
    const { status, delivery_status } = req.body
    const validStatuses = ['new', 'preparing', 'ready', 'served', 'completed', 'cancelled']
    if (status && !validStatuses.includes(status))
      return res.status(400).json({ error: 'Invalid status' })

    if (await checkDb()) {
      try {
        // Use explicit SET to avoid COALESCE issues with MySQL null handling
        const setClauses = []
        const params     = []
        let idx          = 1

        if (status)          { setClauses.push(`status=$${idx++}`);          params.push(status) }
        if (delivery_status) { setClauses.push(`delivery_status=$${idx++}`); params.push(delivery_status) }
        setClauses.push(`updated_at=NOW()`)
        params.push(parseInt(req.params.id), req.tenantId)

        const result = await query(
          `UPDATE orders SET ${setClauses.join(', ')} WHERE id=$${idx++} AND tenant_id=$${idx} RETURNING *`,
          params
        )

        const updatedOrder = result.rows[0]
        if (updatedOrder) {
          if (updatedOrder.table_number && ['served', 'completed', 'cancelled'].includes(status)) {
            try {
              const ac = await query(
                `SELECT COUNT(*) as count FROM orders WHERE tenant_id=$1 AND table_number=$2 AND status IN ('new','preparing','ready')`,
                [req.tenantId, updatedOrder.table_number]
              )
              if (parseInt(ac.rows[0]?.count ?? ac.rows[0]?.cnt ?? 0) === 0) {
                await query(`UPDATE tables SET status='available' WHERE number=$1 AND tenant_id=$2`, [updatedOrder.table_number, req.tenantId])
              }
            } catch (_) {}
          }
          const io = req.app.get('io')
          if (io) {
            io.emit('order_status_updated', updatedOrder)
            io.emit(`order-${updatedOrder.order_ref}`, updatedOrder)
            io.emit(`tenant-${req.tenantId}-order-update`, updatedOrder)
          }
          return res.json(updatedOrder)
        }
      } catch (dbErr) {
        console.warn('DB update failed in PUT /orders/:id/status:', dbErr.message)
        if (isConnError(dbErr)) dbAvailable = false
      }
    }

    const updated = local.updateOrderStatus(parseInt(req.params.id), status)
    if (!updated) return res.status(404).json({ error: 'Order not found' })
    const io = req.app.get('io')
    if (io) io.emit('order_status_updated', updated)
    return res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/orders/:id ────────────────────────────────────────────────────
router.delete('/:id', requireAuth, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (await checkDb()) {
      try {
        // Delete items first (FK), then the order
        await query(`DELETE FROM order_items WHERE order_id=$1`, [id])
        await query(`DELETE FROM orders WHERE id=$1 AND tenant_id=$2`, [id, req.tenantId])
        return res.status(204).end()
      } catch (dbErr) {
        console.warn('DB delete failed in DELETE /orders:', dbErr.message)
        if (isConnError(dbErr)) dbAvailable = false
      }
    }
    local.deleteOrder(id)
    return res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
