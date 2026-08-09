const sql = require('mssql')
require('dotenv').config()
const config = {
  server: process.env.DB_SERVER || 'MARK\\SQLEXPRESS01',
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_NAME || 'RestaurantDB',
  user: process.env.DB_USER || 'menuapp',
  password: process.env.DB_PASS || 'MenuApp2024!',
  options: {
    trustServerCertificate: true,
    encrypt: false,
    enableArithAbort: true,
  },
  connectionTimeout: 5000,   // fail fast if DB unreachable
  requestTimeout: 8000,      // max 8s per query
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
}
let pool = null
async function getPool() {
  if (pool && pool.connected) return pool
  const connectTimeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('DB connection timed out (5s)')), 5000)
  )
  try {
    pool = await Promise.race([sql.connect(config), connectTimeout])
    pool.on('error', (err) => {
      console.error('❌ Pool error:', err.message)
      pool = null
    })
    console.log('✅ Connected to SQL Server RestaurantDB')
    return pool
  } catch (err) {
    pool = null
    console.error('❌ DB connection failed:', err.message)
    throw err
  }
}
const QUERY_TIMEOUT_MS = 8000
async function query(sqlText, params = {}) {
  const p = await getPool()
  const request = p.request()
  Object.entries(params).forEach(([key, { type, value }]) => {
    request.input(key, type, value)
  })
  // Race the query against a timeout so we never hang indefinitely
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`DB query timed out after ${QUERY_TIMEOUT_MS}ms`)), QUERY_TIMEOUT_MS)
  )
  return Promise.race([request.query(sqlText), timeout])
}
module.exports = { sql, query, getPool }
