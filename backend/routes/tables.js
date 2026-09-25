const router = require('express').Router()
const { query } = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')
const { resolveTenant, requireTenantMatch } = require('../middleware/tenant')
const { checkTableLimit } = require('../middleware/subscriptionGuard')
const local = require('../localStore')

router.use(resolveTenant)

router.get('/', async (req, res) => {
  try {
    try {
      const r = await query(`SELECT * FROM tables WHERE tenant_id = $1 ORDER BY number`, [req.tenantId])
      return res.json(r.rows)
    } catch (dbErr) {
      console.warn('DB unavailable in GET /tables, using seed fallback:', dbErr.message)
    }
    res.json(local.getSeedTables(req.tenantId))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', requireAuth, requireTenantMatch, requireRole(['admin']), checkTableLimit, async (req, res) => {
  try {
    const { number, capacity, status } = req.body
    if (!number) return res.status(400).json({ error: 'Table number required' })

    try {
      const r = await query(`
        INSERT INTO tables (tenant_id, number, capacity, status)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [req.tenantId, number, parseInt(capacity) || 4, status || 'available'])
      if (r.rows[0]) return res.status(201).json(r.rows[0])
    } catch (dbErr) {
      console.warn('DB write failed in POST /tables, using localStore:', dbErr.message)
    }

    const newTable = local.createTable(req.tenantId, { number, capacity, status })
    res.status(201).json(newTable)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:id', requireAuth, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    const { number, capacity, status } = req.body

    try {
      const r = await query(`
        UPDATE tables SET number=$1, capacity=$2, status=$3
        WHERE id=$4 AND tenant_id=$5
        RETURNING *
      `, [number, parseInt(capacity) || 4, status || 'available', parseInt(req.params.id), req.tenantId])
      if (r.rows[0]) return res.json(r.rows[0])
    } catch (dbErr) {
      console.warn('DB update failed in PUT /tables/:id, using localStore:', dbErr.message)
    }

    const updated = local.updateTable(req.params.id, req.tenantId, { number, capacity, status })
    if (!updated) return res.status(404).json({ error: 'Not found' })
    res.json(updated)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/:id', requireAuth, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    try {
      await query(`DELETE FROM tables WHERE id=$1 AND tenant_id=$2`, [parseInt(req.params.id), req.tenantId])
      return res.status(204).end()
    } catch (dbErr) {
      console.warn('DB delete failed in DELETE /tables/:id, using localStore:', dbErr.message)
    }

    local.deleteTable(req.params.id, req.tenantId)
    res.status(204).end()
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router

