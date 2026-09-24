const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 10,
})

pool.on('error', (err) => {
  console.error('❌ Pool error:', err.message)
})

// query(sqlText, valuesArray)
// e.g. query('SELECT * FROM users WHERE id = $1', [42])
async function query(text, values = []) {
  try {
    const res = await pool.query(text, values)
    // Mimic mssql's recordset shape so routes work with minimal changes
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

// Test connection on startup
pool.query('SELECT 1').then(() => {
  console.log('✅ Connected to PostgreSQL')
}).catch(err => {
  console.error('❌ DB connection failed:', err.message)
})

module.exports = { query, getPool, pool }
