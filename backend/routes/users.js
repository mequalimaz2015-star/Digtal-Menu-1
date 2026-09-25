const router = require('express').Router()
const bcrypt = require('bcryptjs')
const { query } = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')
const { resolveTenant, requireTenantMatch } = require('../middleware/tenant')
const { checkStaffLimit } = require('../middleware/subscriptionGuard')

router.use(resolveTenant)

// GET /api/users/waiters — PUBLIC (tenant scoped)
router.get('/waiters', async (req, res) => {
  try {
    const r = await query(`
      SELECT id, name, role FROM users
      WHERE tenant_id = $1 AND role = 'waiter' AND is_active = true
      ORDER BY name
    `, [req.tenantId])
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/users (admin)
router.get('/', requireAuth, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    const r = await query(`
      SELECT id, name, email, role, is_active, created_at 
      FROM users 
      WHERE tenant_id = $1 
      ORDER BY created_at
    `, [req.tenantId])
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/users (admin) - Enforces staff account limit
router.post('/', requireAuth, requireTenantMatch, requireRole(['admin']), checkStaffLimit, async (req, res) => {
  try {
    const { name, email, password, role } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
    const hash = await bcrypt.hash(password, 10)
    const r = await query(`
      INSERT INTO users (tenant_id, name, email, password, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email, role, is_active, created_at
    `, [req.tenantId, name || '', email, hash, (role || 'waiter').toLowerCase()])
    res.status(201).json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/users/:id
router.put('/:id', requireAuth, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    const { name, email, role, is_active, password } = req.body
    let r
    if (password) {
      const hash = await bcrypt.hash(password, 10)
      r = await query(`
        UPDATE users SET name=$1, email=$2, role=$3, is_active=$4, password=$5
        WHERE id=$6 AND tenant_id=$7
        RETURNING id, name, email, role, is_active
      `, [name, email, (role || '').toLowerCase(), is_active ? true : false, hash, parseInt(req.params.id), req.tenantId])
    } else {
      r = await query(`
        UPDATE users SET name=$1, email=$2, role=$3, is_active=$4
        WHERE id=$5 AND tenant_id=$6
        RETURNING id, name, email, role, is_active
      `, [name, email, (role || '').toLowerCase(), is_active ? true : false, parseInt(req.params.id), req.tenantId])
    }
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// DELETE /api/users/:id
router.delete('/:id', requireAuth, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    await query(`DELETE FROM users WHERE id=$1 AND tenant_id=$2`, [parseInt(req.params.id), req.tenantId])
    res.status(204).end()
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
