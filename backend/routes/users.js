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
      WHERE tenant_id = $1 AND role = 'waiter' AND (is_active = 1 OR is_active = true)
      ORDER BY name
    `, [req.tenantId])
    res.json(r.rows || [])
  } catch (err) {
    console.error('GET /waiters error:', err.message)
    res.status(500).json({ error: err.message })
  }
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

    // Plain INSERT — no RETURNING (avoids SQL Server emulation bugs)
    const ins = await query(`
      INSERT INTO users (tenant_id, name, email, password, role, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
    `, [req.tenantId, name || '', email, hash, (role || 'waiter').toLowerCase()])

    // Resolve inserted id via insertId (MySQL) or SCOPE_IDENTITY (SQL Server) or SELECT fallback
    let newId = ins.insertId ? Number(ins.insertId) : null
    if (!newId) {
      const sel = await query(
        `SELECT TOP 1 id FROM users WHERE tenant_id=$1 AND LOWER(email)=LOWER($2) ORDER BY id DESC`,
        [req.tenantId, email]
      )
      newId = sel.rows[0] ? Number(sel.rows[0].id) : null
    }

    if (newId) {
      const row = await query(
        `SELECT id, name, email, role, is_active, created_at FROM users WHERE id=$1`,
        [newId]
      )
      return res.status(201).json(row.rows[0] || { id: newId, name: name || '', email, role: role || 'waiter', is_active: true })
    }
    res.status(201).json({ name: name || '', email, role: role || 'waiter', is_active: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/users/:id
router.put('/:id', requireAuth, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    const { name, email, role, is_active, password } = req.body
    const uid = parseInt(req.params.id)

    if (password) {
      const hash = await bcrypt.hash(password, 10)
      await query(`
        UPDATE users SET name=$1, email=$2, role=$3, is_active=$4, password=$5
        WHERE id=$6 AND tenant_id=$7
      `, [name, email, (role || '').toLowerCase(), is_active ? 1 : 0, hash, uid, req.tenantId])
    } else {
      await query(`
        UPDATE users SET name=$1, email=$2, role=$3, is_active=$4
        WHERE id=$5 AND tenant_id=$6
      `, [name, email, (role || '').toLowerCase(), is_active ? 1 : 0, uid, req.tenantId])
    }

    const row = await query(
      `SELECT id, name, email, role, is_active FROM users WHERE id=$1 AND tenant_id=$2`,
      [uid, req.tenantId]
    )
    res.json(row.rows[0] || { id: uid, name, email, role, is_active })
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
