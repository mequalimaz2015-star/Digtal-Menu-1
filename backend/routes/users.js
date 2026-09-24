const router = require('express').Router()
const bcrypt = require('bcryptjs')
const { query } = require('../db')
const auth = require('../middleware/auth')

// GET /api/users/waiters — PUBLIC
router.get('/waiters', async (req, res) => {
  try {
    const r = await query(`
      SELECT id, name, role FROM users
      WHERE role = 'waiter' AND is_active = true
      ORDER BY name
    `)
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/', auth, async (req, res) => {
  try {
    const r = await query(`SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at`)
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', auth, async (req, res) => {
  try {
    const { name, email, password, role } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
    const hash = await bcrypt.hash(password, 10)
    const r = await query(`
      INSERT INTO users (name, email, password, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, role, is_active, created_at
    `, [name || '', email, hash, (role || 'waiter').toLowerCase()])
    res.status(201).json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:id', auth, async (req, res) => {
  try {
    const { name, email, role, is_active, password } = req.body
    let r
    if (password) {
      const hash = await bcrypt.hash(password, 10)
      r = await query(`
        UPDATE users SET name=$1, email=$2, role=$3, is_active=$4, password=$5
        WHERE id=$6
        RETURNING id, name, email, role, is_active
      `, [name, email, (role || '').toLowerCase(), is_active ? true : false, hash, parseInt(req.params.id)])
    } else {
      r = await query(`
        UPDATE users SET name=$1, email=$2, role=$3, is_active=$4
        WHERE id=$5
        RETURNING id, name, email, role, is_active
      `, [name, email, (role || '').toLowerCase(), is_active ? true : false, parseInt(req.params.id)])
    }
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/:id', auth, async (req, res) => {
  try {
    await query(`DELETE FROM users WHERE id=$1`, [parseInt(req.params.id)])
    res.status(204).end()
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
