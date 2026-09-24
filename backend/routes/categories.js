const router = require('express').Router()
const { query } = require('../db')
const auth = require('../middleware/auth')

// GET /api/categories  (public)
router.get('/', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM categories WHERE is_active=true ORDER BY sort_order`)
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/categories/all  (admin)
router.get('/all', auth, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM categories ORDER BY sort_order`)
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/categories
router.post('/', auth, async (req, res) => {
  try {
    const { name, name_am, icon, color, sort_order } = req.body
    if (!name) return res.status(400).json({ error: 'Name required' })
    const result = await query(`
      INSERT INTO categories (name, name_am, icon, color, sort_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [name, name_am || '', icon || '🍽️', color || '#e85d04', sort_order || 0])
    res.status(201).json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/categories/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, name_am, icon, color, sort_order, is_active } = req.body
    const result = await query(`
      UPDATE categories SET
        name=$1, name_am=$2, icon=$3, color=$4, sort_order=$5, is_active=$6
      WHERE id=$7
      RETURNING *
    `, [name, name_am || '', icon || '🍽️', color || '#e85d04', sort_order || 0, is_active !== false, parseInt(req.params.id)])
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' })
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/categories/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await query(`DELETE FROM categories WHERE id=$1`, [parseInt(req.params.id)])
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
