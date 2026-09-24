const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { query } = require('../db')
const auth = require('../middleware/auth')

// Fallback admin used when DB is unreachable
const FALLBACK_ADMIN = {
  id: 1,
  name: 'Admin User',
  email: 'admin@abc.com',
  // bcrypt hash of "admin123"
  password: '$2a$10$zLByROZ8hW39Q874QZ/ZL.DFOX/6X3lmHhvE49G84vQxBfEW20XIS',
  role: 'admin',
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' })

    let user = null

    try {
      const result = await query(
        `SELECT * FROM users WHERE email = $1 AND is_active = true`,
        [email]
      )
      user = result.rows[0]
    } catch (dbErr) {
      console.warn('DB unavailable, using fallback admin:', dbErr.message)
      if (email === FALLBACK_ADMIN.email) {
        user = FALLBACK_ADMIN
      }
    }

    if (!user) return res.status(401).json({ error: 'Invalid credentials' })
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'digital-menu-secret-key-2024-abc-restaurant',
      { expiresIn: process.env.JWT_EXPIRES || '24h' }
    )
    res.json({
      access_token: token,
      token_type: 'bearer',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, email, role, is_active, created_at FROM users WHERE id = $1`,
      [req.user.id]
    )
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
