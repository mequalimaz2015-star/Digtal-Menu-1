const mysql = require('mysql2/promise')
require('dotenv').config()

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '')

let pool = null

if (hasDb) {
  // Supports mysql:// or standard connection parameters
  pool = mysql.createPool(process.env.DATABASE_URL)

  // Test connection on startup
  pool.query('SELECT 1')
    .then(() => {
      console.log('✅ Connected to MySQL')
    })
    .catch(err => {
      console.error('❌ DB connection failed:', err.message)
    })
} else {
  console.log('ℹ️ No DATABASE_URL set. Running in resilient localStore (JSON) mode.')
}

// query helper matching your previous structure
async function query(text, values = []) {
  if (!pool) {
    throw new Error('DATABASE_URL not configured')
  }
  try {
    // Replace PostgreSQL style placeholders ($1, $2) with MySQL style (?) if needed, 
    // or ensure your queries use (?) for MySQL.
    const [rows] = await pool.query(text, values)
    return { rows, recordset: rows }
  } catch (err) {
    console.error('❌ DB query error:', err.message)
    throw err
  }
}

async function getPool() {
  return pool
}

module.exports = { query, getPool, pool }
