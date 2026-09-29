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
  rating, review_count, calories, discount, allergens, menu_item_ref`

// ── Generate a restaurant-prefixed menu item ref: e.g. "B-001" for "Bloom" ───
// Prefix = first letter(s) of each word in the restaurant name, max 3 chars
// Number = last used number for this tenant + 1, zero-padded to 3 digits
async function generateMenuItemRef(tenantId) {
  try {
    // Get restaurant name
    const tRes = await query(`SELECT name FROM tenants WHERE id=$1`, [tenantId])
    const tenantName = tRes.rows[0]?.name || 'MENU'

    // Build prefix: first letter of each word, uppercase, max 3 chars
    const prefix = tenantName
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase())
      .join('')
      .slice(0, 3)
      .replace(/[^A-Z]/g, 'M') || 'M'

    // Find the highest existing ref number for this tenant's prefix
    const refRes = await query(
      `SELECT menu_item_ref FROM menu_items
       WHERE tenant_id=$1 AND menu_item_ref LIKE $2
       ORDER BY menu_item_ref DESC LIMIT 1`,
      [tenantId, `${prefix}-%`]
    )

    let nextNum = 1
    if (refRes.rows[0]?.menu_item_ref) {
      const parts = refRes.rows[0].menu_item_ref.split('-')
      const lastNum = parseInt(parts[parts.length - 1]) || 0
      nextNum = lastNum + 1
    }

    return `${prefix}-${String(nextNum).padStart(3, '0')}`
  } catch (_) {
    // Fallback if DB not available
    return `M-${String(Date.now()).slice(-4)}`
  }
}

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
      const menuItemRef = await generateMenuItemRef(req.tenantId)

      const result = await query(`
        INSERT INTO menu_items (tenant_id,category_id,name,name_am,description,description_am,price,image_url,
          prep_time,is_spicy,is_vegetarian,is_available,is_featured,is_popular,is_best_seller,
          chef_recommended,rating,calories,discount,allergens,menu_item_ref)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
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
        menuItemRef,
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

// ── POST /api/menu-items/bulk ──────────────────────────────────────────────────
// Atomically creates categories (if new) + all items from AI/Excel import preview.
// Body: { categories: [{name, icon, color}], items: [{categoryName, name, ...}] }
router.post('/bulk', requireAuth, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    const { categories = [], items = [] } = req.body
    if (!items.length) return res.status(400).json({ error: 'No items to import' })

    const tid = req.tenantId

    // 1. Upsert categories — create if name doesn't exist for this tenant
    const categoryIdMap = {} // categoryName → id
    for (const cat of categories) {
      if (!cat.name) continue
      try {
        // Check if category already exists
        const existing = await query(
          `SELECT id FROM categories WHERE tenant_id=$1 AND LOWER(name)=LOWER($2) LIMIT 1`,
          [tid, cat.name]
        )
        if (existing.rows[0]) {
          categoryIdMap[cat.name] = existing.rows[0].id
        } else {
          const sortRes = await query(
            `SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM categories WHERE tenant_id=$1`, [tid]
          )
          const sortOrder = sortRes.rows[0]?.next || 1
          const ins = await query(
            `INSERT INTO categories (tenant_id, name, name_am, icon, color, sort_order, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING id`,
            [tid, cat.name, cat.nameAm || '', cat.icon || '🍽️', cat.color || '#e85d04', sortOrder]
          )
          categoryIdMap[cat.name] = ins.rows[0].id
        }
      } catch (catErr) {
        console.warn(`Bulk import: category "${cat.name}" error:`, catErr.message)
      }
    }

    // 2. Insert items — skip rows missing name or price
    const created = []
    const skipped = []

    // Get the prefix + current counter once, then increment in-process
    // (avoids N separate DB reads for each item)
    let refPrefix = 'M'
    let refCounter = 1
    try {
      const tRes = await query(`SELECT name FROM tenants WHERE id=$1`, [tid])
      const tName = tRes.rows[0]?.name || 'MENU'
      refPrefix = tName
        .split(/\s+/)
        .map(w => w.charAt(0).toUpperCase())
        .join('')
        .slice(0, 3)
        .replace(/[^A-Z]/g, 'M') || 'M'

      // Find the last ref number used for this prefix
      const lastRes = await query(
        `SELECT menu_item_ref FROM menu_items
         WHERE tenant_id=$1 AND menu_item_ref LIKE $2
         ORDER BY menu_item_ref DESC LIMIT 1`,
        [tid, `${refPrefix}-%`]
      )
      if (lastRes.rows[0]?.menu_item_ref) {
        const parts = lastRes.rows[0].menu_item_ref.split('-')
        refCounter = (parseInt(parts[parts.length - 1]) || 0) + 1
      }
    } catch (_) {}

    for (const item of items) {
      if (!item.name || !item.price) { skipped.push(item.name || '(unnamed)'); continue }

      const catId = categoryIdMap[item.categoryName]
      if (!catId) { skipped.push(item.name); continue }

      const menuItemRef = `${refPrefix}-${String(refCounter).padStart(3, '0')}`

      try {
        const r = await query(`
          INSERT INTO menu_items
            (tenant_id, category_id, name, name_am, description, description_am,
             price, image_url, prep_time, is_spicy, is_vegetarian, is_available,
             is_featured, is_popular, is_best_seller, chef_recommended,
             rating, calories, discount, allergens, menu_item_ref)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
          RETURNING id, menu_item_ref
        `, [
          tid,
          catId,
          item.name,
          item.nameAm        || '',
          item.description   || '',
          item.descriptionAm || '',
          parseFloat(item.price)    || 0,
          item.imageUrl      || item.image_url || '',
          parseInt(item.prepTime || item.prep_time) || 15,
          item.isSpicy        ? true : false,
          item.isVegetarian   ? true : false,
          true,
          item.isFeatured     ? true : false,
          item.isBestSeller   ? true : false,
          item.isBestSeller   ? true : false,
          false,
          parseFloat(item.rating) || 4.5,
          item.calories ? parseInt(item.calories) : null,
          parseFloat(item.discount) || 0,
          item.allergens || '',
          menuItemRef,
        ])
        created.push({ id: r.rows[0].id, name: item.name, ref: r.rows[0].menu_item_ref })
        refCounter++ // only increment on success
      } catch (itemErr) {
        console.warn(`Bulk import: item "${item.name}" error:`, itemErr.message)
        skipped.push(item.name)
      }
    }

    return res.status(201).json({
      created: created.length,
      skipped: skipped.length,
      createdItems: created,
      skippedNames: skipped,
      categoriesCreated: Object.keys(categoryIdMap).length,
    })
  } catch (err) {
    console.error('Bulk import error:', err.message)
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

