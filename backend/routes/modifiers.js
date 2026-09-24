const router = require('express').Router()
const { query } = require('../db')
const auth = require('../middleware/auth')

// GET /api/modifiers  (admin)
router.get('/', auth, async (req, res) => {
  try {
    const groups = await query(`SELECT * FROM modifier_groups ORDER BY id`)
    const mods = await query(`SELECT * FROM modifiers ORDER BY group_id, id`)
    const result = groups.rows.map(g => ({
      ...g,
      modifiers: mods.rows.filter(m => m.group_id === g.id)
    }))
    res.json(result)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/modifiers/public
router.get('/public', async (req, res) => {
  try {
    const groups = await query(`SELECT * FROM modifier_groups ORDER BY id`)
    const mods = await query(`SELECT * FROM modifiers WHERE is_available=true ORDER BY group_id, id`)
    const result = groups.rows.map(g => ({
      ...g,
      modifiers: mods.rows.filter(m => m.group_id === g.id)
    }))
    res.json(result)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/modifiers/groups
router.post('/groups', auth, async (req, res) => {
  try {
    const { name, name_am, required, multi_select, max_select } = req.body
    if (!name) return res.status(400).json({ error: 'Name required' })
    const r = await query(
      `INSERT INTO modifier_groups (name, name_am, required, multi_select, max_select)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, name_am || '', required ? true : false, multi_select ? true : false, max_select || 1]
    )
    res.status(201).json({ ...r.rows[0], modifiers: [] })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/modifiers/groups/:id
router.put('/groups/:id', auth, async (req, res) => {
  try {
    const { name, name_am, required, multi_select, max_select } = req.body
    const r = await query(
      `UPDATE modifier_groups SET name=$1, name_am=$2, required=$3, multi_select=$4, max_select=$5
       WHERE id=$6
       RETURNING *`,
      [name, name_am || '', required ? true : false, multi_select ? true : false, max_select || 1, parseInt(req.params.id)]
    )
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// DELETE /api/modifiers/groups/:id
router.delete('/groups/:id', auth, async (req, res) => {
  try {
    await query(`DELETE FROM modifier_groups WHERE id=$1`, [parseInt(req.params.id)])
    res.status(204).end()
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/modifiers/groups/:groupId/items
router.post('/groups/:groupId/items', auth, async (req, res) => {
  try {
    const { name, name_am, price } = req.body
    if (!name) return res.status(400).json({ error: 'Name required' })
    const r = await query(
      `INSERT INTO modifiers (group_id, name, name_am, price)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [parseInt(req.params.groupId), name, name_am || '', parseFloat(price) || 0]
    )
    res.status(201).json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/modifiers/items/:id
router.put('/items/:id', auth, async (req, res) => {
  try {
    const { name, name_am, price, is_available } = req.body
    const r = await query(
      `UPDATE modifiers SET name=$1, name_am=$2, price=$3, is_available=$4
       WHERE id=$5
       RETURNING *`,
      [name, name_am || '', parseFloat(price) || 0, is_available !== false, parseInt(req.params.id)]
    )
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// DELETE /api/modifiers/items/:id
router.delete('/items/:id', auth, async (req, res) => {
  try {
    await query(`DELETE FROM modifiers WHERE id=$1`, [parseInt(req.params.id)])
    res.status(204).end()
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
