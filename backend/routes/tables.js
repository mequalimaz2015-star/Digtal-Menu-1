const router = require('express').Router()
const { query } = require('../db')
const auth = require('../middleware/auth')

router.get('/', async (req, res) => {
  try {
    const r = await query(`SELECT * FROM tables ORDER BY number`)
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', auth, async (req, res) => {
  try {
    const { number, capacity, status } = req.body
    if (!number) return res.status(400).json({ error: 'Table number required' })
    const r = await query(`
      INSERT INTO tables (number, capacity, status)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [number, parseInt(capacity) || 4, status || 'available'])
    res.status(201).json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:id', auth, async (req, res) => {
  try {
    const { number, capacity, status } = req.body
    const r = await query(`
      UPDATE tables SET number=$1, capacity=$2, status=$3
      WHERE id=$4
      RETURNING *
    `, [number, parseInt(capacity) || 4, status || 'available', parseInt(req.params.id)])
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/:id', auth, async (req, res) => {
  try {
    await query(`DELETE FROM tables WHERE id=$1`, [parseInt(req.params.id)])
    res.status(204).end()
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
