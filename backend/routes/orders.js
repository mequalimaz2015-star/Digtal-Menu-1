const router = require('express').Router()
const { query } = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')
const { resolveTenant, requireTenantMatch } = require('../middleware/tenant')
const local = require('../localStore')

router.use(resolveTenant)

// DB connectivity probe — only reset on real connection failures
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
  return msg.includes('connect') || msg.includes('econnrefused') ||
         msg.includes('offline')  || msg.includes('not configured')
}

setInterval(() => { dbAvailable = null }, 30000)

// ── POST /api/orders ──────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      tableNumber, customerName, phone, notes, items, subtotal, vat, serviceCharge,
      grandTotal, estimatedTime, orderType, pickupTime, deliveryAddress, deliveryLat,
      deliveryLng, deliveryFee, deliveryZoneId, paymentMethod, sessionId,
    } = req.body

    if (!items || !items.length) return res.status(400).json({ error: 'Items required' })

    const orderRef     = `ORD-${Date.now()}`
    const validTypes   = ['dine_in', 'takeaway', 'delivery']
    const resolvedType = validTypes.includes(orderType) ? orderType : 'dine_in'

    let pickupNumber = null
    if (resolvedType === 'takeaway') {
      try {
        if (await checkDb()) {
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
            delivery_zone_id, payment_method, payment_status, delivery_status, session_id
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
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
          sessionId || null,
        ])
        const order = orderResult.rows[0]
        const orderId = Number(order.id)  // cast BigInt → Number for MySQL

        for (const item of items) {
          await query(`
            INSERT INTO order_items
              (order_id, menu_item_name, price, quantity, modifiers, special_instructions, item_total)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
          `, [
            orderId,
            item.name || '',
            parseFloat(item.price) || 0,
            parseInt(item.qty) || 1,
            item.modifiers || '',
            item.specialInstructions || '',
            (parseFloat(item.price) || 0) * (parseInt(item.qty) || 1),
          ])
        }

        // Fetch items back for the response
        let orderItems = []
        try {
          const ir = await query(`SELECT * FROM order_items WHERE order_id=$1`, [orderId])
          orderItems = ir.rows
        } catch (_) {}

        const finalOrder = { ...order, items: orderItems }

        // Mark table as occupied
        if (resolvedType === 'dine_in' && tableNumber) {
          query(`UPDATE tables SET status='occupied' WHERE number=$1 AND tenant_id=$2`, [String(tableNumber), req.tenantId]).catch(() => {})
        }

        const io = req.app.get('io')
        if (io) {
          // Notify the specific tenant room (admin/staff)
          io.to(`tenant-${req.tenantId}`).emit('new_order', finalOrder)
          // Backward-compat global emit so older clients still work
          io.emit(`tenant-${req.tenantId}-new-order`, finalOrder)
        }

        return res.status(201).json(finalOrder)
      } catch (dbErr) {
        console.error('❌ DB write failed in POST /orders:', dbErr.message)
        if (isConnError(dbErr)) dbAvailable = false
        // Fall through to localStore only on connection errors
        if (!isConnError(dbErr)) {
          return res.status(500).json({ error: 'Failed to save order: ' + dbErr.message })
        }
      }
    }

    // localStore fallback (only when DB truly offline)
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
    console.error('❌ POST /orders unhandled error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/orders ───────────────────────────────────────────────────────────
router.get('/', requireAuth, requireTenantMatch, async (req, res) => {
  try {
    const { status, type } = req.query
    const tid = Number(req.tenantId) || req.tenantId  // ensure numeric

    if (await checkDb()) {
      try {
        let sql    = `SELECT * FROM orders WHERE tenant_id = $1`
        const params = [tid]
        let idx    = 2

        if (status) { sql += ` AND status=$${idx++}`;     params.push(status) }
        if (type)   { sql += ` AND order_type=$${idx++}`; params.push(type)   }
        sql += ` ORDER BY created_at DESC`

        const ordersResult = await query(sql, params)
        const orders = ordersResult.rows || []

        // Fetch items per order — cast id to Number to avoid BigInt issues on MySQL
        for (const o of orders) {
          const orderId = Number(o.id)
          try {
            const ir = await query(`SELECT * FROM order_items WHERE order_id=$1`, [orderId])
            o.items = ir.rows || []
          } catch (itemErr) {
            console.warn(`Could not fetch items for order ${orderId}:`, itemErr.message)
            o.items = []
          }
        }

        return res.json(orders)
      } catch (dbErr) {
        console.error('❌ DB read failed in GET /orders:', dbErr.message, '| tenantId:', tid)
        if (isConnError(dbErr)) {
          dbAvailable = false
        } else {
          // Non-connection DB error — return 500 with details so we can diagnose
          return res.status(500).json({ error: 'Order fetch failed: ' + dbErr.message })
        }
      }
    }

    // Only reach here when DB is truly offline
    return res.json(local.getOrders(status, tid))
  } catch (err) {
    console.error('❌ GET /orders unhandled error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/orders/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const tid = Number(req.tenantId) || req.tenantId
    if (await checkDb()) {
      try {
        const idVal     = parseInt(req.params.id) || 0
        const ordResult = await query(
          `SELECT * FROM orders WHERE tenant_id=$1 AND (id=$2 OR order_ref=$3)`,
          [tid, idVal, req.params.id]
        )
        if (ordResult.rows[0]) {
          const order = ordResult.rows[0]
          const orderId = Number(order.id)  // cast BigInt → Number for MySQL
          try {
            const ir = await query(`SELECT * FROM order_items WHERE order_id=$1`, [orderId])
            order.items = ir.rows || []
          } catch (_) { order.items = [] }
          return res.json(order)
        }
      } catch (dbErr) {
        console.warn('GET /orders/:id DB error:', dbErr.message)
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
    const tid = Number(req.tenantId) || req.tenantId
    const validStatuses = ['new', 'preparing', 'ready', 'served', 'completed', 'cancelled']
    if (status && !validStatuses.includes(status))
      return res.status(400).json({ error: 'Invalid status' })

    if (await checkDb()) {
      try {
        // Build explicit SET clause to avoid COALESCE issues on MySQL
        const setClauses = []
        const params     = []
        let idx          = 1

        if (status)          { setClauses.push(`status=$${idx++}`);          params.push(status) }
        if (delivery_status) { setClauses.push(`delivery_status=$${idx++}`); params.push(delivery_status) }
        if (!setClauses.length) return res.status(400).json({ error: 'No status provided' })

        setClauses.push(`updated_at=NOW()`)
        params.push(parseInt(req.params.id), tid)

        const result = await query(
          `UPDATE orders SET ${setClauses.join(', ')} WHERE id=$${idx++} AND tenant_id=$${idx} RETURNING *`,
          params
        )

        const updatedOrder = result.rows[0]
        if (updatedOrder) {
          // Free the table if order is complete
          if (updatedOrder.table_number && ['served', 'completed', 'cancelled'].includes(status)) {
            try {
              const ac = await query(
                `SELECT COUNT(*) as cnt FROM orders WHERE tenant_id=$1 AND table_number=$2 AND status IN ('new','preparing','ready')`,
                [tid, updatedOrder.table_number]
              )
              const cnt = parseInt(ac.rows[0]?.cnt ?? ac.rows[0]?.count ?? 0)
              if (cnt === 0) {
                await query(`UPDATE tables SET status='available' WHERE number=$1 AND tenant_id=$2`, [updatedOrder.table_number, tid])
              }
            } catch (_) {}
          }
          const io = req.app.get('io')
          if (io) {
            // Notify the customer's scoped room: customer-{tenantId}-{sessionId}
            // The order stores session_id set at order creation time
            const sessionId = updatedOrder.session_id
            if (sessionId) {
              io.to(`customer-${tid}-${sessionId}`).emit('order_status_updated', updatedOrder)
            }
            // Also emit on a named channel so clients can listen by order ref
            io.to(`tenant-${tid}`).emit('order_status_updated', updatedOrder)
            // Fallback: keep tenant-scoped channel for backward compat
            io.emit(`order-${updatedOrder.order_ref}`, updatedOrder)
          }
          return res.json(updatedOrder)
        }
      } catch (dbErr) {
        console.warn('PUT /orders/:id/status DB error:', dbErr.message)
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
    const id  = parseInt(req.params.id)
    const tid = Number(req.tenantId) || req.tenantId
    if (await checkDb()) {
      try {
        await query(`DELETE FROM order_items WHERE order_id=$1`, [id])
        await query(`DELETE FROM orders WHERE id=$1 AND tenant_id=$2`, [id, tid])
        return res.status(204).end()
      } catch (dbErr) {
        console.warn('DELETE /orders/:id DB error:', dbErr.message)
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
