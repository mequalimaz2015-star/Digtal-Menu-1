const router = require('express').Router()
const { query } = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')
const { resolveTenant, requireTenantMatch } = require('../middleware/tenant')
const local = require('../localStore')

router.use(resolveTenant)

// GET /api/modifiers  (admin)
router.get('/', requireAuth, requireTenantMatch, async (req, res) => {
  try {
    try {
      const groups = await query(`SELECT * FROM modifier_groups WHERE tenant_id = $1 ORDER BY id`, [req.tenantId])
      const mods = await query(`
        SELECT m.* FROM modifiers m 
        JOIN modifier_groups g ON m.group_id = g.id 
        WHERE g.tenant_id = $1 ORDER BY m.group_id, m.id
      `, [req.tenantId])
      const result = groups.rows.map(g => ({
        ...g,
        modifiers: mods.rows.filter(m => m.group_id === g.id)
      }))
      return res.json(result)
    } catch (dbErr) {
      console.warn('DB unavailable in GET /modifiers, using seed fallback:', dbErr.message)
    }
    res.json(local.getSeedModifiers(req.tenantId))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/modifiers/public
router.get('/public', async (req, res) => {
  try {
    try {
      const groups = await query(`SELECT * FROM modifier_groups WHERE tenant_id = $1 ORDER BY id`, [req.tenantId])
      const mods = await query(`
        SELECT m.* FROM modifiers m 
        JOIN modifier_groups g ON m.group_id = g.id 
        WHERE g.tenant_id = $1 AND m.is_available=true ORDER BY m.group_id, m.id
      `, [req.tenantId])
      const result = groups.rows.map(g => ({
        ...g,
        modifiers: mods.rows.filter(m => m.group_id === g.id)
      }))
      return res.json(result)
    } catch (dbErr) {
      console.warn('DB unavailable in GET /modifiers/public, using seed fallback:', dbErr.message)
    }
    res.json(local.getSeedModifiers(req.tenantId).map(g => ({
      ...g,
      modifiers: g.modifiers.filter(m => m.is_available)
    })))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/modifiers/groups
router.post('/groups', requireAuth, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    const { name, name_am, required, multi_select, max_select } = req.body
    if (!name) return res.status(400).json({ error: 'Name required' })

    try {
      const r = await query(
        `INSERT INTO modifier_groups (tenant_id, name, name_am, required, multi_select, max_select)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [req.tenantId, name, name_am || '', required ? true : false, multi_select ? true : false, max_select || 1]
      )
      if (r.rows[0]) return res.status(201).json({ ...r.rows[0], modifiers: [] })
    } catch (dbErr) {
      console.warn('DB write failed in POST /modifiers/groups, using localStore:', dbErr.message)
    }

    const newGroup = local.createModifierGroup(req.tenantId, { name, name_am, required, multi_select, max_select })
    res.status(201).json(newGroup)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/modifiers/groups/:id
router.put('/groups/:id', requireAuth, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    const { name, name_am, required, multi_select, max_select } = req.body

    try {
      const r = await query(
        `UPDATE modifier_groups SET name=$1, name_am=$2, required=$3, multi_select=$4, max_select=$5
         WHERE id=$6 AND tenant_id=$7
         RETURNING *`,
        [name, name_am || '', required ? true : false, multi_select ? true : false, max_select || 1, parseInt(req.params.id), req.tenantId]
      )
      if (r.rows[0]) return res.json(r.rows[0])
    } catch (dbErr) {
      console.warn('DB update failed in PUT /modifiers/groups/:id, using localStore:', dbErr.message)
    }

    const updated = local.updateModifierGroup(req.params.id, req.tenantId, { name, name_am, required, multi_select, max_select })
    if (!updated) return res.status(404).json({ error: 'Not found' })
    res.json(updated)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// DELETE /api/modifiers/groups/:id
router.delete('/groups/:id', requireAuth, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    try {
      await query(`DELETE FROM modifier_groups WHERE id=$1 AND tenant_id=$2`, [parseInt(req.params.id), req.tenantId])
      return res.status(204).end()
    } catch (dbErr) {
      console.warn('DB delete failed in DELETE /modifiers/groups/:id, using localStore:', dbErr.message)
    }

    local.deleteModifierGroup(req.params.id, req.tenantId)
    res.status(204).end()
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/modifiers/groups/:groupId/items
router.post('/groups/:groupId/items', requireAuth, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    const { name, name_am, price } = req.body
    if (!name) return res.status(400).json({ error: 'Name required' })

    try {
      const r = await query(
        `INSERT INTO modifiers (group_id, name, name_am, price)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [parseInt(req.params.groupId), name, name_am || '', parseFloat(price) || 0]
      )
      if (r.rows[0]) return res.status(201).json(r.rows[0])
    } catch (dbErr) {
      console.warn('DB write failed in POST /modifiers items, using localStore:', dbErr.message)
    }

    const newMod = local.createModifier(req.params.groupId, { name, name_am, price })
    res.status(201).json(newMod)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/modifiers/items/:id
router.put('/items/:id', requireAuth, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    const { name, name_am, price, is_available } = req.body

    try {
      const r = await query(
        `UPDATE modifiers SET name=$1, name_am=$2, price=$3, is_available=$4
         WHERE id=$5
         RETURNING *`,
        [name, name_am || '', parseFloat(price) || 0, is_available !== false, parseInt(req.params.id)]
      )
      if (r.rows[0]) return res.json(r.rows[0])
    } catch (dbErr) {
      console.warn('DB update failed in PUT /modifiers/items/:id, using localStore:', dbErr.message)
    }

    const updated = local.updateModifier(req.params.id, { name, name_am, price, is_available })
    if (!updated) return res.status(404).json({ error: 'Not found' })
    res.json(updated)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// DELETE /api/modifiers/items/:id
router.delete('/items/:id', requireAuth, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    try {
      await query(`DELETE FROM modifiers WHERE id=$1`, [parseInt(req.params.id)])
      return res.status(204).end()
    } catch (dbErr) {
      console.warn('DB delete failed in DELETE /modifiers/items/:id, using localStore:', dbErr.message)
    }

    local.deleteModifier(req.params.id)
    res.status(204).end()
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router

