const router = require('express').Router()
const { query } = require('../db')
const auth = require('../middleware/auth')

// POST /api/reviews
router.post('/', async (req, res) => {
  try {
    const { orderRef, tableNumber, customerName, phone, overallRating, foodRating, serviceRating, comment } = req.body
    if (!overallRating || overallRating < 1 || overallRating > 5)
      return res.status(400).json({ error: 'overall_rating must be 1–5' })

    const result = await query(`
      INSERT INTO reviews (order_ref, table_number, customer_name, phone, overall_rating, food_rating, service_rating, comment)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `, [
      orderRef || '',
      tableNumber || '',
      customerName || '',
      phone || '',
      parseInt(overallRating),
      parseInt(foodRating) || null,
      parseInt(serviceRating) || null,
      comment || '',
    ])

    await query(`
      UPDATE restaurant SET
        rating       = (SELECT AVG(overall_rating::float) FROM reviews),
        review_count = (SELECT COUNT(*) FROM reviews)
      WHERE id=1
    `)

    res.status(201).json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/reviews  (admin)
router.get('/', auth, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM reviews ORDER BY created_at DESC`)
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/reviews/summary  (public)
router.get('/summary', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*)                                          AS total,
        AVG(overall_rating::float)                       AS avg_overall,
        AVG(food_rating::float)                          AS avg_food,
        AVG(service_rating::float)                       AS avg_service,
        SUM(CASE WHEN overall_rating=5 THEN 1 ELSE 0 END) AS five_star,
        SUM(CASE WHEN overall_rating=4 THEN 1 ELSE 0 END) AS four_star,
        SUM(CASE WHEN overall_rating=3 THEN 1 ELSE 0 END) AS three_star,
        SUM(CASE WHEN overall_rating=2 THEN 1 ELSE 0 END) AS two_star,
        SUM(CASE WHEN overall_rating=1 THEN 1 ELSE 0 END) AS one_star
      FROM reviews
    `)
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/reviews/:id  (admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    await query(`DELETE FROM reviews WHERE id=$1`, [parseInt(req.params.id)])
    await query(`
      UPDATE restaurant SET
        rating       = COALESCE((SELECT AVG(overall_rating::float) FROM reviews), 4.8),
        review_count = (SELECT COUNT(*) FROM reviews)
      WHERE id=1
    `)
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
