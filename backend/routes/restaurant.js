const router = require('express').Router()
const { query } = require('../db')
const auth = require('../middleware/auth')

// GET /api/restaurant
router.get('/', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM restaurant LIMIT 1`)
    res.json(result.rows[0] || {})
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/restaurant
router.put('/', auth, async (req, res) => {
  try {
    const { name, name_am, tagline, address, phone, wifi_password, working_hours, vat_rate, service_charge_rate, currency } = req.body
    await query(`
      UPDATE restaurant SET
        name=$1, name_am=$2, tagline=$3, address=$4, phone=$5,
        wifi_password=$6, working_hours=$7, vat_rate=$8,
        service_charge_rate=$9, currency=$10
      WHERE id=1
    `, [name, name_am, tagline, address, phone, wifi_password, working_hours, vat_rate, service_charge_rate, currency])
    const result = await query(`SELECT * FROM restaurant LIMIT 1`)
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
