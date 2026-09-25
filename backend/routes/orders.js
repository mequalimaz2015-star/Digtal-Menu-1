const router = require('express').Router()
const { query } = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')
const { resolveTenant, requireTenantMatch } = require('../middleware/tenant')
const local = require('../localStore')

router.use(resolveTenant)

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

setInterval(() => { dbAvailable = null }, 30000)

// POST /api/orders
router.post('/', async (req, res) => {
  try {
    const { 
      tableNumber, customerName, phone, notes, items, subtotal, vat, serviceCharge, 
      grandTotal, estimatedTime, orderType, pickupTime, deliveryAddress, deliveryLat, 
      deliveryLng, deliveryFee, deliveryZoneId, paymentMethod 
    } = req.body

    if (!items || !items.length) return res.status(400).json({ error: 'Items required' })

    const orderRef = `ORD-${Date.now()}`
    const validTypes = ['dine_in', 'takeaway', 'delivery']
    const resolvedOrderType = validTypes.includes(orderType) ? orderType : 'dine_in'

    let pickupNumber = null
    if (resolvedOrderType === 'takeaway') {
      const useDb2 = await checkDb()
      if (useDb2) {
        try {
          const countRes = await query(
            `SELECT COUNT(*) AS cnt FROM orders WHERE tenant_id=$1 AND order_type='takeaway' AND created_at::date = CURRENT_DATE`,
            [req.tenantId]
          )
          const todayCount = (parseInt(countRes.rows[0]?.cnt) || 0) + 1
          pickupNumber = `T-${String(todayCount).padStart(3, '0')}`
        } catch (_) { pickupNumber = `T-${Date.now().toString().slice(-3)}` }
      } else {
        pickupNumber = `T-${Date.now().toString().slice(-3)}`
      }
    }

    const useDb = await checkDb()

    if (useDb) {
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
          resolvedOrderType === 'dine_in' ? (tableNumber || '') : (resolvedOrderType === 'delivery' ? 'Delivery' : 'Takeaway'),
          customerName || '',
          phone || '',
          notes || '',
          parseFloat(subtotal) || 0,
          parseFloat(vat) || 0,
          parseFloat(serviceCharge) || 0,
          parseFloat(grandTotal) || 0,
          parseInt(estimatedTime) || 20,
          resolvedOrderType,
          pickupNumber || '',
          pickupTime || '',
          deliveryAddress || '',
          parseFloat(deliveryLat) || null,
          parseFloat(deliveryLng) || null,
          parseFloat(deliveryFee) || 0,
          deliveryZoneId ? parseInt(deliveryZoneId) : null,
          paymentMethod || 'cash',
          paymentMethod === 'online' ? 'pending' : 'pending',
          resolvedOrderType === 'delivery' ? 'pending' : 'pending'
        ])
        const order = orderResult.rows[0]

        for (const item of items) {
          await query(`
            INSERT INTO order_items (order_id, menu_item_name, price, quantity, modifiers, special_instructions, item_total)
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

        const itemsResult = await query(`SELECT * FROM order_items WHERE order_id=$1`, [order.id])
        const finalOrder = { ...order, items: itemsResult.rows }

        if (resolvedOrderType === 'dine_in' && tableNumber) {
          try {
            await query(`UPDATE tables SET status='occupied' WHERE number=$1 AND tenant_id=$2`, [String(tableNumber), req.tenantId])
          } catch (e) {}
        }

        // Emit Socket.IO event scoped to tenant
        const io = req.app.get('io')
        if (io) {
          io.emit('new_order', finalOrder)
          io.emit(`tenant-${req.tenantId}-new-order`, finalOrder)
        }

        return res.status(201).json(finalOrder)
      } catch (dbErr) {
        console.warn('DB write failed, falling back to local store:', dbErr.message)
        dbAvailable = false
      }
    }

    // Local store fallback
    const order = local.createOrder({ orderRef, tenantId: req.tenantId, tableNumber: resolvedOrderType === 'dine_in' ? tableNumber : resolvedOrderType, customerName, phone, notes, subtotal, vat, serviceCharge, grandTotal, estimatedTime, orderType: resolvedOrderType, pickupNumber, pickupTime, deliveryAddress, deliveryLat, deliveryLng })
    for (const item of items) {
      local.addOrderItem({ orderId: order.id, name: item.name, price: item.price, qty: item.qty, modifiers: item.modifiers, specialInstructions: item.specialInstructions })
    }
    const saved = local.getOrderById(order.id)
    return res.status(201).json(saved)

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/orders  (admin/kitchen/waiter)
router.get('/', requireAuth, requireTenantMatch, async (req, res) => {
  try {
    const { status, type } = req.query
    const useDb = await checkDb()

    if (useDb) {
      try {
        let sqlText = `SELECT * FROM orders WHERE tenant_id = $1`
        const params = [req.tenantId]
        let idx = 2

        if (status) {
          sqlText += ` AND status=$${idx++}`
          params.push(status)
        }
        if (type) {
          sqlText += ` AND order_type=$${idx++}`
          params.push(type)
        }

        sqlText += ` ORDER BY created_at DESC`
        const ordersResult = await query(sqlText, params)
        const orders = ordersResult.rows

        if (orders.length > 0) {
          const ids = orders.map(o => o.id)
          const placeholders = ids.map((_, i) => `$${i + 1}`).join(',')
          const itemsResult = await query(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`, ids)
          orders.forEach(o => { o.items = itemsResult.rows.filter(i => i.order_id === o.id) })
        }

        return res.json(orders)
      } catch (dbErr) {
        console.warn('DB read failed, using local store:', dbErr.message)
        dbAvailable = false
      }
    }

    return res.json(local.getOrders(status, req.tenantId))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/orders/:id
router.get('/:id', async (req, res) => {
  try {
    const useDb = await checkDb()

    if (useDb) {
      try {
        const idVal = parseInt(req.params.id) || 0
        const ordResult = await query(
          `SELECT * FROM orders WHERE tenant_id=$1 AND (id=$2 OR order_ref=$3)`,
          [req.tenantId, idVal, req.params.id]
        )
        if (ordResult.rows[0]) {
          const order = ordResult.rows[0]
          const itemsResult = await query(`SELECT * FROM order_items WHERE order_id=$1`, [order.id])
          return res.json({ ...order, items: itemsResult.rows })
        }
      } catch (_) { dbAvailable = false }
    }

    const order = local.getOrderById(req.params.id)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    return res.json(order)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/orders/:id/status  (admin/kitchen/waiter)
router.put('/:id/status', requireAuth, requireTenantMatch, async (req, res) => {
  try {
    const { status, delivery_status } = req.body
    const validStatuses = ['new', 'preparing', 'ready', 'served', 'completed', 'cancelled']
    if (status && !validStatuses.includes(status))
      return res.status(400).json({ error: 'Invalid status' })

    const useDb = await checkDb()
    if (useDb) {
      try {
        const result = await query(`
          UPDATE orders 
          SET status=COALESCE($1, status),
              delivery_status=COALESCE($2, delivery_status),
              updated_at=NOW()
          WHERE id=$3 AND tenant_id=$4
          RETURNING *
        `, [status, delivery_status, parseInt(req.params.id), req.tenantId])

        const updatedOrder = result.rows[0]
        if (updatedOrder) {
          if (updatedOrder.table_number && (status === 'served' || status === 'completed' || status === 'cancelled')) {
            try {
              const activeCheck = await query(
                `SELECT COUNT(*) as count FROM orders WHERE tenant_id=$1 AND table_number=$2 AND status IN ('new','preparing','ready')`,
                [req.tenantId, updatedOrder.table_number]
              )
              if (parseInt(activeCheck.rows[0].count) === 0) {
                await query(`UPDATE tables SET status='available' WHERE number=$1 AND tenant_id=$2`, [updatedOrder.table_number, req.tenantId])
              }
            } catch (e) {}
          }
          const io = req.app.get('io')
          if (io) {
            io.emit('order_status_updated', updatedOrder)
            io.emit(`order-${updatedOrder.order_ref}`, updatedOrder)
            io.emit(`tenant-${req.tenantId}-order-update`, updatedOrder)
          }
          return res.json(updatedOrder)
        }
      } catch (_) { dbAvailable = false }
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

// DELETE /api/orders/:id  (admin)
router.delete('/:id', requireAuth, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const useDb = await checkDb()

    if (useDb) {
      try {
        await query(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE id=$1 AND tenant_id=$2)`, [id, req.tenantId])
        await query(`DELETE FROM orders WHERE id=$1 AND tenant_id=$2`, [id, req.tenantId])
      } catch (_) { dbAvailable = false }
    }

    local.deleteOrder(id)
    return res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
