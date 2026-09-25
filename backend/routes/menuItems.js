const router = require('express').Router()
const { query } = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')
const { resolveTenant, requireTenantMatch } = require('../middleware/tenant')
const { checkMenuItemLimit } = require('../middleware/subscriptionGuard')
const local = require('../localStore')

router.use(resolveTenant)

const cols = `id, tenant_id, category_id, name, name_am, description, description_am,
  price, image_url, prep_time, is_spicy, is_vegetarian, is_available,
  is_featured, is_popular, is_best_seller, chef_recommended,
  rating, review_count, calories, discount, allergens`

// GET /api/menu-items  (public customer)
router.get('/', async (req, res) => {
  try {
    const { category_id } = req.query
    try {
      if (category_id) {
        const result = await query(
          `SELECT ${cols} FROM menu_items WHERE tenant_id=$1 AND is_available=true AND category_id=$2 ORDER BY is_featured DESC, is_best_seller DESC, name`,
          [req.tenantId, parseInt(category_id)]
        )
        return res.json(result.rows)
      }
      const result = await query(
        `SELECT ${cols} FROM menu_items WHERE tenant_id=$1 AND is_available=true ORDER BY is_featured DESC, is_best_seller DESC, name`,
        [req.tenantId]
      )
      return res.json(result.rows)
    } catch (dbErr) {
      console.warn('DB unavailable in GET /menu-items, using seed fallback:', dbErr.message)
    }
    const items = local.getSeedMenuItems(req.tenantId, category_id).filter(i => i.is_available)
    res.json(items)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/menu-items/all  (admin)
router.get('/all', requireAuth, requireTenantMatch, async (req, res) => {
  try {
    try {
      const result = await query(`SELECT ${cols} FROM menu_items WHERE tenant_id=$1 ORDER BY category_id, name`, [req.tenantId])
      return res.json(result.rows)
    } catch (dbErr) {
      console.warn('DB unavailable in GET /menu-items/all, using seed fallback:', dbErr.message)
    }
    res.json(local.getSeedMenuItems(req.tenantId))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/menu-items/featured
router.get('/featured', async (req, res) => {
  try {
    try {
      const result = await query(`SELECT ${cols} FROM menu_items WHERE tenant_id=$1 AND is_featured=true AND is_available=true`, [req.tenantId])
      return res.json(result.rows)
    } catch (dbErr) {
      console.warn('DB unavailable in GET /menu-items/featured, using seed fallback:', dbErr.message)
    }
    res.json(local.getSeedMenuItems(req.tenantId).filter(i => i.is_featured && i.is_available))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/menu-items/search?q=
router.get('/search', async (req, res) => {
  try {
    const q = req.query.q || ''
    try {
      const result = await query(
        `SELECT ${cols} FROM menu_items WHERE tenant_id=$1 AND is_available=true AND (name ILIKE $2 OR name_am ILIKE $2 OR description ILIKE $2)`,
        [req.tenantId, `%${q}%`]
      )
      return res.json(result.rows)
    } catch (dbErr) {
      console.warn('DB unavailable in GET /menu-items/search, using seed fallback:', dbErr.message)
    }
    const lower = q.toLowerCase()
    res.json(local.getSeedMenuItems(req.tenantId).filter(i =>
      i.is_available && (
        i.name.toLowerCase().includes(lower) ||
        (i.name_am || '').toLowerCase().includes(lower) ||
        (i.description || '').toLowerCase().includes(lower)
      )
    ))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/menu-items/:id
router.get('/:id', async (req, res) => {
  try {
    try {
      const result = await query(`SELECT ${cols} FROM menu_items WHERE id=$1 AND tenant_id=$2`, [parseInt(req.params.id), req.tenantId])
      if (result.rows[0]) return res.json(result.rows[0])
    } catch (dbErr) {
      console.warn('DB unavailable in GET /menu-items/:id, using seed fallback:', dbErr.message)
    }
    const item = local.getSeedMenuItems(req.tenantId).find(i => i.id === parseInt(req.params.id))
    if (!item) return res.status(404).json({ error: 'Not found' })
    res.json(item)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/menu-items - Enforces plan menu limit
router.post('/', requireAuth, requireTenantMatch, requireRole(['admin']), checkMenuItemLimit, async (req, res) => {
  try {
    const d = req.body
    if (!d.name || !d.price || !d.category_id)
      return res.status(400).json({ error: 'Name, price and category required' })

    try {
      const result = await query(`
        INSERT INTO menu_items (tenant_id,category_id,name,name_am,description,description_am,price,image_url,
          prep_time,is_spicy,is_vegetarian,is_available,is_featured,is_popular,is_best_seller,
          chef_recommended,rating,calories,discount,allergens)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        RETURNING *
      `, [
        req.tenantId,
        parseInt(d.category_id),
        d.name,
        d.name_am || '',
        d.description || '',
        d.description_am || '',
        parseFloat(d.price),
        d.image_url || '',
        d.prep_time || 15,
        d.is_spicy ? true : false,
        d.is_vegetarian ? true : false,
        d.is_available !== false,
        d.is_featured ? true : false,
        d.is_popular ? true : false,
        d.is_best_seller ? true : false,
        d.chef_recommended ? true : false,
        parseFloat(d.rating) || 4.5,
        d.calories ? parseInt(d.calories) : null,
        parseFloat(d.discount) || 0,
        Array.isArray(d.allergens) ? d.allergens.join(',') : d.allergens || '',
      ])
      if (result.rows[0]) return res.status(201).json(result.rows[0])
    } catch (dbErr) {
      console.warn('DB write failed in POST /menu-items, using localStore:', dbErr.message)
    }

    const newItem = local.createMenuItem(req.tenantId, d)
    res.status(201).json(newItem)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/menu-items/:id
router.put('/:id', requireAuth, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    const d = req.body

    try {
      const result = await query(`
        UPDATE menu_items SET
          category_id=$1, name=$2, name_am=$3, description=$4, description_am=$5,
          price=$6, image_url=$7, prep_time=$8, is_spicy=$9, is_vegetarian=$10,
          is_available=$11, is_featured=$12, is_popular=$13, is_best_seller=$14,
          chef_recommended=$15, rating=$16, calories=$17, discount=$18, allergens=$19
        WHERE id=$20 AND tenant_id=$21
        RETURNING *
      `, [
        parseInt(d.category_id),
        d.name,
        d.name_am || '',
        d.description || '',
        d.description_am || '',
        parseFloat(d.price),
        d.image_url || '',
        d.prep_time || 15,
        d.is_spicy ? true : false,
        d.is_vegetarian ? true : false,
        d.is_available !== false,
        d.is_featured ? true : false,
        d.is_popular ? true : false,
        d.is_best_seller ? true : false,
        d.chef_recommended ? true : false,
        parseFloat(d.rating) || 4.5,
        d.calories ? parseInt(d.calories) : null,
        parseFloat(d.discount) || 0,
        Array.isArray(d.allergens) ? d.allergens.join(',') : d.allergens || '',
        parseInt(req.params.id),
        req.tenantId
      ])
      if (result.rows[0]) return res.json(result.rows[0])
    } catch (dbErr) {
      console.warn('DB update failed in PUT /menu-items/:id, using localStore:', dbErr.message)
    }

    const updated = local.updateMenuItem(req.params.id, req.tenantId, d)
    if (!updated) return res.status(404).json({ error: 'Not found' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/menu-items/:id
router.delete('/:id', requireAuth, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    try {
      await query(`DELETE FROM menu_items WHERE id=$1 AND tenant_id=$2`, [parseInt(req.params.id), req.tenantId])
      return res.status(204).end()
    } catch (dbErr) {
      console.warn('DB delete failed in DELETE /menu-items/:id, using localStore:', dbErr.message)
    }

    local.deleteMenuItem(req.params.id, req.tenantId)
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router

