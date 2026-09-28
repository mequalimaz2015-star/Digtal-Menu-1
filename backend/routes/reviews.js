const router = require('express').Router()
const { query } = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')
const { resolveTenant, requireTenantMatch } = require('../middleware/tenant')

router.use(resolveTenant)

// In-memory fallback store when DB is offline
const localReviews = []

// ── POST /api/reviews ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { orderRef, tableNumber, customerName, phone, overallRating, foodRating, serviceRating, comment } = req.body
    if (!overallRating || overallRating < 1 || overallRating > 5)
      return res.status(400).json({ error: 'overall_rating must be 1–5' })

    const reviewData = {
      tenant_id:      req.tenantId,
      order_ref:      orderRef    || '',
      table_number:   tableNumber || '',
      customer_name:  customerName|| '',
      phone:          phone       || '',
      overall_rating: parseInt(overallRating),
      food_rating:    parseInt(foodRating)    || null,
      service_rating: parseInt(serviceRating) || null,
      comment:        comment || '',
      created_at:     new Date().toISOString(),
    }

    try {
      const result = await query(`
        INSERT INTO reviews
          (tenant_id, order_ref, table_number, customer_name, phone,
           overall_rating, food_rating, service_rating, comment)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
      `, [
        reviewData.tenant_id,
        reviewData.order_ref,
        reviewData.table_number,
        reviewData.customer_name,
        reviewData.phone,
        reviewData.overall_rating,
        reviewData.food_rating,
        reviewData.service_rating,
        reviewData.comment,
      ])
      return res.status(201).json(result.rows[0])
    } catch (dbErr) {
      console.warn('DB write failed in POST /reviews, using memory fallback:', dbErr.message)
    }

    // Memory fallback — store review locally so at least it's saved for this session
    const fallback = { id: Date.now(), ...reviewData }
    localReviews.unshift(fallback)
    return res.status(201).json(fallback)
  } catch (err) {
    console.error('POST /reviews unhandled error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/reviews  (admin) ─────────────────────────────────────────────────
router.get('/', requireAuth, requireTenantMatch, async (req, res) => {
  try {
    try {
      const result = await query(
        `SELECT * FROM reviews WHERE tenant_id = $1 ORDER BY created_at DESC`,
        [req.tenantId]
      )
      return res.json(result.rows)
    } catch (dbErr) {
      console.warn('DB read failed in GET /reviews:', dbErr.message)
    }
    // Fallback to in-memory reviews for this session
    res.json(localReviews.filter(r => r.tenant_id === req.tenantId))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/reviews/summary  (public) ───────────────────────────────────────
router.get('/summary', async (req, res) => {
  try {
    try {
      const result = await query(`
        SELECT
          COUNT(*)                                            AS total,
          AVG(overall_rating)                               AS avg_overall,
          AVG(food_rating)                                  AS avg_food,
          AVG(service_rating)                               AS avg_service,
          SUM(CASE WHEN overall_rating=5 THEN 1 ELSE 0 END) AS five_star,
          SUM(CASE WHEN overall_rating=4 THEN 1 ELSE 0 END) AS four_star,
          SUM(CASE WHEN overall_rating=3 THEN 1 ELSE 0 END) AS three_star,
          SUM(CASE WHEN overall_rating=2 THEN 1 ELSE 0 END) AS two_star,
          SUM(CASE WHEN overall_rating=1 THEN 1 ELSE 0 END) AS one_star
        FROM reviews
        WHERE tenant_id = $1
      `, [req.tenantId])
      return res.json(result.rows[0])
    } catch (dbErr) {
      console.warn('DB read failed in GET /reviews/summary:', dbErr.message)
    }

    // Compute summary from in-memory fallback
    const myR = localReviews.filter(r => r.tenant_id === req.tenantId)
    const total = myR.length
    const avg = (key) => total ? myR.reduce((s, r) => s + (r[key] || 0), 0) / total : null
    res.json({
      total,
      avg_overall: avg('overall_rating'),
      avg_food:    avg('food_rating'),
      avg_service: avg('service_rating'),
      five_star:  myR.filter(r => r.overall_rating === 5).length,
      four_star:  myR.filter(r => r.overall_rating === 4).length,
      three_star: myR.filter(r => r.overall_rating === 3).length,
      two_star:   myR.filter(r => r.overall_rating === 2).length,
      one_star:   myR.filter(r => r.overall_rating === 1).length,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/reviews/:id  (admin) ─────────────────────────────────────────
router.delete('/:id', requireAuth, requireTenantMatch, requireRole(['admin']), async (req, res) => {
  try {
    try {
      await query(
        `DELETE FROM reviews WHERE id=$1 AND tenant_id=$2`,
        [parseInt(req.params.id), req.tenantId]
      )
      return res.status(204).end()
    } catch (dbErr) {
      console.warn('DB delete failed in DELETE /reviews/:id:', dbErr.message)
    }
    // Remove from memory fallback
    const idx = localReviews.findIndex(r => r.id === parseInt(req.params.id))
    if (idx !== -1) localReviews.splice(idx, 1)
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
