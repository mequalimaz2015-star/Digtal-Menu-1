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
          `SELECT ${cols} FROM menu_items WHERE tenant_id=$1 AND is_available=1 AND category_id=$2 ORDER BY is_featured DESC, is_best_seller DESC, name`,
          [req.tenantId, parseInt(category_id)]
        )
        return res.json(result.rows)
      }
      const result = await query(
        `SELECT ${cols} FROM menu_items WHERE tenant_id=$1 AND is_available=1 ORDER BY is_featured DESC, is_best_seller DESC, name`,
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
// Auto-backfills missing menu_item_ref values before returning
router.get('/all', requireAuth, requireTenantMatch, async (req, res) => {
  try {
    try {
      // ── Backfill any items that are missing a menu_item_ref ──────────────
      try {
        const missing = await query(
          `SELECT id FROM menu_items WHERE tenant_id=$1 AND (menu_item_ref IS NULL OR menu_item_ref = '')`,
          [req.tenantId]
        )
        if (missing.rows.length > 0) {
          // Build prefix from tenant name
          const tRes = await query(`SELECT name FROM tenants WHERE id=$1`, [req.tenantId])
          const tName = tRes.rows[0]?.name || 'MENU'
          const prefix = tName
            .split(/\s+/)
            .map(w => w.charAt(0).toUpperCase())
            .join('')
            .slice(0, 3)
            .replace(/[^A-Z]/g, 'M') || 'M'

          // Find highest existing ref number for this prefix
          const lastRes = await query(
            `SELECT menu_item_ref FROM menu_items
             WHERE tenant_id=$1 AND menu_item_ref LIKE $2
             ORDER BY menu_item_ref DESC LIMIT 1`,
            [req.tenantId, `${prefix}-%`]
          )
          let counter = 1
          if (lastRes.rows[0]?.menu_item_ref) {
            const parts = lastRes.rows[0].menu_item_ref.split('-')
            counter = (parseInt(parts[parts.length - 1]) || 0) + 1
          }

          for (const row of missing.rows) {
            const ref = `${prefix}-${String(counter).padStart(3, '0')}`
            await query(
              `UPDATE menu_items SET menu_item_ref=$1 WHERE id=$2 AND tenant_id=$3`,
              [ref, row.id, req.tenantId]
            )
            counter++
          }
        }
      } catch (backfillErr) {
        console.warn('menu_item_ref backfill skipped:', backfillErr.message)
      }

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
      const result = await query(`SELECT ${cols} FROM menu_items WHERE tenant_id=$1 AND is_featured=1 AND is_available=1`, [req.tenantId])
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
        `SELECT ${cols} FROM menu_items WHERE tenant_id=$1 AND is_available=1 AND (name LIKE $2 OR name_am LIKE $2 OR description LIKE $2)`,
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

// ── Image URL lookup by food name/category ────────────────────────────────────
function getImageUrl(name, categoryName) {
  const n = (name || '').toLowerCase()
  const c = (categoryName || '').toLowerCase()

  // Specific Ethiopian / common dishes
  if (/injera|firfir|kitfo|tibs|gored|derek|alicha|awaze/.test(n))
    return 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&q=80'
  if (/doro wat|doro wot|chicken stew/.test(n))
    return 'https://images.unsplash.com/photo-1574484284002-952d92a03a05?w=400&q=80'
  if (/shiro|misir|lentil|fasolia/.test(n))
    return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80'
  if (/fatira|fetira/.test(n))
    return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80'
  if (/manyeesh|zaatar|manakish/.test(n))
    return 'https://images.unsplash.com/photo-1590736969955-71cc94901144?w=400&q=80'
  if (/cookie|brownie|biscuit/.test(n))
    return 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80'
  if (/sandwich|sub|wrap|club/.test(n))
    return 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80'
  if (/burger|beef burger|chicken burger/.test(n))
    return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80'
  if (/pizza|margherita|pepperoni/.test(n))
    return 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&q=80'
  if (/pasta|spaghetti|fettuccine|penne/.test(n))
    return 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&q=80'
  if (/steak|ribeye|sirloin/.test(n))
    return 'https://images.unsplash.com/photo-1546833998-877b37c2e5c6?w=400&q=80'
  if (/chicken|grilled chicken|fried chicken/.test(n))
    return 'https://images.unsplash.com/photo-1598103442097-8b74394b95c8?w=400&q=80'
  if (/fish|tilapia|salmon|sea bass/.test(n))
    return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&q=80'
  if (/shrimp|prawn|seafood/.test(n))
    return 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=400&q=80'
  if (/salad|green salad|caesar/.test(n))
    return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80'
  if (/soup|stew|broth/.test(n))
    return 'https://images.unsplash.com/photo-1547592180-85f173990554?w=400&q=80'
  if (/rice|pilaf|biryani|fried rice/.test(n))
    return 'https://images.unsplash.com/photo-1536304993881-ff86e0c5c5af?w=400&q=80'
  if (/egg|omelette|scrambled|boiled egg/.test(n))
    return 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=400&q=80'
  if (/pancake|waffle|crepe/.test(n))
    return 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=400&q=80'
  if (/toast|bread|croissant/.test(n))
    return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80'
  if (/cake|cheesecake|tiramisu/.test(n))
    return 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80'
  if (/ice cream|gelato|sundae/.test(n))
    return 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400&q=80'
  if (/chocolate|brownie|truffle/.test(n))
    return 'https://images.unsplash.com/photo-1481391319762-47dff72954d9?w=400&q=80'
  if (/coffee|espresso|cappuccino|latte|macchiato/.test(n))
    return 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80'
  if (/tea|chai|green tea/.test(n))
    return 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80'
  if (/juice|mango juice|orange juice|smoothie/.test(n))
    return 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=400&q=80'
  if (/water|mineral water|sparkling/.test(n))
    return 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80'
  if (/soda|cola|fanta|sprite|soft drink/.test(n))
    return 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80'
  if (/beer|wine|alcohol/.test(n))
    return 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400&q=80'
  if (/breakfast/.test(n) || /breakfast/.test(c))
    return 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=400&q=80'
  if (/gyro|shawarma|kebab|wrap/.test(n))
    return 'https://images.unsplash.com/photo-1597712682289-f9f49f30c0e6?w=400&q=80'
  if (/falafel|hummus|pita/.test(n))
    return 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&q=80'
  if (/taco|burrito|quesadilla/.test(n))
    return 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&q=80'
  if (/sushi|roll|sashimi/.test(n))
    return 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=400&q=80'

  // Category fallbacks
  if (/beef|meat|steak/.test(c))
    return 'https://images.unsplash.com/photo-1546833998-877b37c2e5c6?w=400&q=80'
  if (/chicken|poultry/.test(c))
    return 'https://images.unsplash.com/photo-1598103442097-8b74394b95c8?w=400&q=80'
  if (/fish|seafood/.test(c))
    return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&q=80'
  if (/salad|veg/.test(c))
    return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80'
  if (/pizza/.test(c))
    return 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&q=80'
  if (/burger/.test(c))
    return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80'
  if (/pasta|noodle/.test(c))
    return 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&q=80'
  if (/soup|stew/.test(c))
    return 'https://images.unsplash.com/photo-1547592180-85f173990554?w=400&q=80'
  if (/dessert|cake|sweet/.test(c))
    return 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80'
  if (/coffee|tea/.test(c))
    return 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80'
  if (/drink|beverage|juice/.test(c))
    return 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=400&q=80'
  if (/breakfast/.test(c))
    return 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=400&q=80'

  // Generic food fallback
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80'
}

// ── POST /api/menu-items/bulk ──────────────────────────────────────────────────
// Atomically creates categories (if new) + all items from AI/Excel import preview.
// Body: { categories: [{name, icon, color}], items: [{categoryName, name, ...}] }
router.post('/bulk', requireAuth, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    const { categories = [], items = [] } = req.body
    if (!items.length) return res.status(400).json({ error: 'No items to import' })

    const tid = req.tenantId

    // 1. Upsert categories — keys stored LOWERCASE for case-insensitive lookup
    const categoryIdMap = {} // catName.toLowerCase().trim() → id

    const allCatNames = new Set([
      ...categories.map(c => c.name).filter(Boolean),
      ...items.map(i => i.categoryName).filter(Boolean),
    ])

    const catStyleMap = {}
    categories.forEach(c => { if (c.name) catStyleMap[c.name.toLowerCase().trim()] = c })

    for (const catName of allCatNames) {
      const catKey = catName.toLowerCase().trim()
      try {
        // Try to find existing category first
        const existing = await query(
          `SELECT id FROM categories WHERE tenant_id=$1 AND LOWER(name)=LOWER($2) LIMIT 1`,
          [tid, catName]
        )
        if (existing.rows[0]) {
          categoryIdMap[catKey] = Number(existing.rows[0].id)
          console.log(`📂 Bulk cat found existing: "${catName}" → id ${existing.rows[0].id}`)
          continue
        }

        const sortRes = await query(
          `SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM categories WHERE tenant_id=$1`, [tid]
        )
        const sortOrder = Number(sortRes.rows[0]?.next || 1)
        const catStyle  = catStyleMap[catKey] || {}

        // INSERT then immediately SELECT back — works for MySQL and any DB
        // Note: name_am/icon/color columns might not exist on all deployments;
        // if this INSERT fails, the catch block will try a minimal INSERT.
        try {
          await query(
            `INSERT INTO categories (tenant_id, name, name_am, icon, color, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [tid, catName, catStyle.nameAm || '', catStyle.icon || '🍽️', catStyle.color || '#e85d04', sortOrder]
          )
        } catch (insertErr) {
          // Fallback: minimal INSERT with only required columns
          console.warn(`Bulk import: full category INSERT failed (${insertErr.message}), trying minimal INSERT`)
          await query(
            `INSERT INTO categories (tenant_id, name) VALUES ($1,$2)`,
            [tid, catName]
          )
        }

        // Always SELECT back — don't rely on insertId
        const sel = await query(
          `SELECT id FROM categories WHERE tenant_id=$1 AND LOWER(name)=LOWER($2) LIMIT 1`,
          [tid, catName]
        )
        if (sel.rows[0]) {
          categoryIdMap[catKey] = Number(sel.rows[0].id)
          console.log(`✅ Bulk cat created: "${catName}" → id ${sel.rows[0].id}`)
        } else {
          console.error(`❌ Bulk import: INSERT succeeded but SELECT returned nothing for category "${catName}"`)
        }
      } catch (catErr) {
        // Duplicate key or race — recover by SELECT
        console.error(`❌ Bulk import: category "${catName}" insert error: ${catErr.message}`)
        try {
          const recoverSel = await query(
            `SELECT id FROM categories WHERE tenant_id=$1 AND LOWER(name)=LOWER($2) LIMIT 1`,
            [tid, catName]
          )
          if (recoverSel.rows[0]) {
            categoryIdMap[catKey] = Number(recoverSel.rows[0].id)
            console.log(`✅ Bulk cat recovered: "${catName}" → id ${recoverSel.rows[0].id}`)
          } else {
            console.error(`❌ Bulk import: could not recover category "${catName}" — both INSERT and SELECT failed`)
          }
        } catch (recoverErr) {
          console.error(`❌ Bulk import: recovery SELECT also failed for "${catName}": ${recoverErr.message}`)
        }
      }
    }

    console.log(`📂 Bulk categoryIdMap keys:`, Object.keys(categoryIdMap))

    // 2. Build ref prefix once
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

    // 3. Insert items
    const created = []
    const skipped = []

    for (const item of items) {
      // Validate — skip only if truly no name or price
      const itemName  = String(item.name  || '').trim()
      const itemPrice = parseFloat(item.price) || 0
      if (!itemName)  { skipped.push('(unnamed)'); continue }
      if (itemPrice <= 0) {
        console.warn(`Bulk import: skipping "${itemName}" — price is "${item.price}" → parsed as ${itemPrice}`)
        skipped.push(itemName)
        continue
      }

      // Lowercase lookup — matches how keys were stored above
      // Fall back to any available category if the specific one wasn't resolved
      let catId = categoryIdMap[(item.categoryName || '').toLowerCase().trim()]
      if (!catId) {
        // Try to find any category for this tenant as last resort
        const fallbackCatId = Object.values(categoryIdMap)[0]
        if (fallbackCatId) {
          console.warn(`Bulk import: no catId for "${item.categoryName}" — using first available category`)
          catId = fallbackCatId
        } else {
          // No categories at all — create a General one
          try {
            await query(
              `INSERT INTO categories (tenant_id, name, name_am, icon, color, sort_order) VALUES ($1,'General','','🍽️','#e85d04',1)`,
              [tid]
            )
            const genSel = await query(`SELECT id FROM categories WHERE tenant_id=$1 AND name='General' LIMIT 1`, [tid])
            if (genSel.rows[0]) {
              catId = Number(genSel.rows[0].id)
              categoryIdMap['general'] = catId
            }
          } catch (_) {
            const genSel = await query(`SELECT id FROM categories WHERE tenant_id=$1 LIMIT 1`, [tid]).catch(() => ({ rows: [] }))
            catId = genSel.rows[0] ? Number(genSel.rows[0].id) : null
          }
        }
      }
      if (!catId) {
        console.warn(`Bulk import: could not resolve any category for "${itemName}" — skipping`)
        skipped.push(itemName)
        continue
      }

      const menuItemRef = `${refPrefix}-${String(refCounter).padStart(3, '0')}`

      // Auto-assign attractive image if none provided
      const imageUrl = item.imageUrl || item.image_url ||
        getImageUrl(itemName, item.categoryName)

      try {
        // Plain INSERT — no RETURNING
        const ins = await query(`
          INSERT INTO menu_items
            (tenant_id, category_id, name, name_am, description, description_am,
             price, image_url, prep_time, is_spicy, is_vegetarian, is_available,
             is_featured, is_popular, is_best_seller, chef_recommended,
             rating, calories, discount, allergens, menu_item_ref)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
        `, [
          tid,
          catId,
          itemName,
          item.nameAm        || '',
          item.description   || '',
          item.descriptionAm || '',
          itemPrice,
          imageUrl,
          parseInt(item.prepTime || item.prep_time) || 15,
          item.isSpicy      ? 1 : 0,
          item.isVegetarian ? 1 : 0,
          1,  // is_available = true
          item.isFeatured   ? 1 : 0,
          item.isBestSeller ? 1 : 0,
          item.isBestSeller ? 1 : 0,
          0,  // chef_recommended
          parseFloat(item.rating) || 4.5,
          item.calories ? parseInt(item.calories) : null,
          parseFloat(item.discount) || 0,
          item.allergens || '',
          menuItemRef,
        ])

        // Resolve new item id
        let newItemId = ins.insertId ? Number(ins.insertId) : null
        if (!newItemId) {
          const sel = await query(
            `SELECT id FROM menu_items WHERE tenant_id=$1 AND menu_item_ref=$2 LIMIT 1`,
            [tid, menuItemRef]
          )
          newItemId = sel.rows[0] ? Number(sel.rows[0].id) : null
        }

        created.push({ id: newItemId, name: itemName, ref: menuItemRef })
        refCounter++
      } catch (itemErr) {
        console.warn(`Bulk import: item "${itemName}" error:`, itemErr.message)
        skipped.push(itemName)
      }
    }

    console.log(`✅ Bulk import: ${created.length} items created, ${skipped.length} skipped | tenant ${tid}`)

    return res.status(201).json({
      created: created.length,
      skipped: skipped.length,
      createdItems: created,
      skippedNames: skipped,
      categoriesCreated: Object.keys(categoryIdMap).length,
      categoryMapKeys: Object.keys(categoryIdMap), // debug info
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

