const { Pool } = require('pg')
require('dotenv').config()

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '')

const pool = hasDb ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 30000,
  max: 10,
}) : null

if (pool) {
  pool.on('error', (err) => {
    console.error('❌ Pool error:', err.message)
  })

  // Test connection on startup
  pool.query('SELECT 1').then(() => {
    console.log('✅ Connected to PostgreSQL')
  }).catch(err => {
    console.error('❌ DB connection failed:', err.message)
  })
} else {
  console.log('ℹ️ No DATABASE_URL set. Running in resilient localStore (JSON) mode.')
}

// query(sqlText, valuesArray)
async function query(text, values = []) {
  if (!pool) {
    throw new Error('DATABASE_URL not configured')
  }
  try {
    const res = await pool.query(text, values)
    res.recordset = res.rows
    return res
  } catch (err) {
    console.error('❌ DB query error:', err.message)
    throw err
  }
}

async function getPool() {
  return pool
}

module.exports = { query, getPool, pool }

