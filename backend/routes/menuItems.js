const router = require('express').Router()
const { query } = require('../db')
const auth = require('../middleware/auth')

const cols = `id, category_id, name, name_am, description, description_am,
  price, image_url, prep_time, is_spicy, is_vegetarian, is_available,
  is_featured, is_popular, is_best_seller, chef_recommended,
  rating, review_count, calories, discount, allergens`

// GET /api/menu-items  (public)
router.get('/', async (req, res) => {
  try {
    const { category_id } = req.query
    if (category_id) {
      const result = await query(
        `SELECT ${cols} FROM menu_items WHERE is_available=true AND category_id=$1 ORDER BY is_featured DESC, is_best_seller DESC, name`,
        [parseInt(category_id)]
      )
      return res.json(result.rows)
    }
    const result = await query(
      `SELECT ${cols} FROM menu_items WHERE is_available=true ORDER BY is_featured DESC, is_best_seller DESC, name`
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/menu-items/all  (admin)
router.get('/all', auth, async (req, res) => {
  try {
    const result = await query(`SELECT ${cols} FROM menu_items ORDER BY category_id, name`)
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/menu-items/featured
router.get('/featured', async (req, res) => {
  try {
    const result = await query(`SELECT ${cols} FROM menu_items WHERE is_featured=true AND is_available=true`)
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/menu-items/search?q=
router.get('/search', async (req, res) => {
  try {
    const q = `%${req.query.q || ''}%`
    const result = await query(
      `SELECT ${cols} FROM menu_items WHERE is_available=true AND (name ILIKE $1 OR name_am ILIKE $1 OR description ILIKE $1)`,
      [q]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/menu-items/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query(`SELECT ${cols} FROM menu_items WHERE id=$1`, [parseInt(req.params.id)])
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' })
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/menu-items
router.post('/', auth, async (req, res) => {
  try {
    const d = req.body
    if (!d.name || !d.price || !d.category_id)
      return res.status(400).json({ error: 'Name, price and category required' })
    const result = await query(`
      INSERT INTO menu_items (category_id,name,name_am,description,description_am,price,image_url,
        prep_time,is_spicy,is_vegetarian,is_available,is_featured,is_popular,is_best_seller,
        chef_recommended,rating,calories,discount,allergens)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
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
    ])
    res.status(201).json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/menu-items/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const d = req.body
    const result = await query(`
      UPDATE menu_items SET
        category_id=$1, name=$2, name_am=$3, description=$4, description_am=$5,
        price=$6, image_url=$7, prep_time=$8, is_spicy=$9, is_vegetarian=$10,
        is_available=$11, is_featured=$12, is_popular=$13, is_best_seller=$14,
        chef_recommended=$15, rating=$16, calories=$17, discount=$18, allergens=$19
      WHERE id=$20
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
    ])
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' })
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/menu-items/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await query(`DELETE FROM menu_items WHERE id=$1`, [parseInt(req.params.id)])
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
