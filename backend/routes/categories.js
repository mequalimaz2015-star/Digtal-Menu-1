const router = require('express').Router()
const { query } = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')
const { resolveTenant, requireTenantMatch } = require('../middleware/tenant')
const local = require('../localStore')

router.use(resolveTenant)

// GET /api/categories  (public customer)
router.get('/', async (req, res) => {
  try {
    try {
      const result = await query(`SELECT * FROM categories WHERE tenant_id = $1 AND is_active=true ORDER BY sort_order`, [req.tenantId])
      return res.json(result.rows)
    } catch (dbErr) {
      console.warn('DB unavailable in GET /categories, using seed fallback:', dbErr.message)
    }
    res.json(local.getSeedCategories(req.tenantId).filter(c => c.is_active))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/categories/all  (admin)
router.get('/all', requireAuth, requireTenantMatch, async (req, res) => {
  try {
    try {
      const result = await query(`SELECT * FROM categories WHERE tenant_id = $1 ORDER BY sort_order`, [req.tenantId])
      return res.json(result.rows)
    } catch (dbErr) {
      console.warn('DB unavailable in GET /categories/all, using seed fallback:', dbErr.message)
    }
    res.json(local.getSeedCategories(req.tenantId))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/categories
router.post('/', requireAuth, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    const { name, name_am, icon, color, sort_order } = req.body
    if (!name) return res.status(400).json({ error: 'Name required' })

    try {
      const result = await query(`
        INSERT INTO categories (tenant_id, name, name_am, icon, color, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [req.tenantId, name, name_am || '', icon || '🍽️', color || '#e85d04', sort_order || 0])
      if (result.rows[0]) return res.status(201).json(result.rows[0])
    } catch (dbErr) {
      console.warn('DB write failed in POST /categories, using localStore:', dbErr.message)
    }

    const newCat = local.createCategory(req.tenantId, { name, name_am, icon, color, sort_order })
    res.status(201).json(newCat)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/categories/:id
router.put('/:id', requireAuth, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    const { name, name_am, icon, color, sort_order, is_active } = req.body

    try {
      const result = await query(`
        UPDATE categories SET
          name=$1, name_am=$2, icon=$3, color=$4, sort_order=$5, is_active=$6
        WHERE id=$7 AND tenant_id=$8
        RETURNING *
      `, [name, name_am || '', icon || '🍽️', color || '#e85d04', sort_order || 0, is_active !== false, parseInt(req.params.id), req.tenantId])
      if (result.rows[0]) return res.json(result.rows[0])
    } catch (dbErr) {
      console.warn('DB update failed in PUT /categories/:id, using localStore:', dbErr.message)
    }

    const updated = local.updateCategory(req.params.id, req.tenantId, {
      name, name_am, icon, color, sort_order, is_active: is_active !== false
    })
    if (!updated) return res.status(404).json({ error: 'Not found' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/categories/:id
router.delete('/:id', requireAuth, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    try {
      await query(`DELETE FROM categories WHERE id=$1 AND tenant_id=$2`, [parseInt(req.params.id), req.tenantId])
      return res.status(204).end()
    } catch (dbErr) {
      console.warn('DB delete failed in DELETE /categories/:id, using localStore:', dbErr.message)
    }

    local.deleteCategory(req.params.id, req.tenantId)
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

