const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

// Auto-detect which DB driver to use based on environment variables
const isMySQL = Boolean(
  process.env.MYSQL_HOST ||
  (process.env.DB_CONNECTION && process.env.DB_CONNECTION.toLowerCase() === 'mysql') ||
  (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('mysql'))
)
const isPostgres = !isMySQL && Boolean(
  process.env.DATABASE_URL ||
  process.env.PGHOST
)
let dbType = 'none'
let mysqlPool = null
let pgPool = null

// ── PostgreSQL ───────────────────────────────────────────────────────────────
if (isPostgres) {
  try {
    const { Pool } = require('pg')
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
        ? false
        : { rejectUnauthorized: false },
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 30000,
      max: 10,
    })
    dbType = 'postgres'
    pgPool.on('error', (err) => console.error('❌ Pool error:', err.message))
    pgPool.query('SELECT 1')
      .then(() => console.log('✅ Connected to PostgreSQL'))
      .catch(err => console.error('❌ DB connection failed:', err.message))
  } catch (err) {
    console.error('❌ Failed to load pg driver:', err.message)
  }
}
// ── MySQL ────────────────────────────────────────────────────────────────────
if (isMySQL) {
  try {
    const mysql = require('mysql2/promise')
    const config = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('mysql')
      ? process.env.DATABASE_URL
      : {
          host:     process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
          port:     parseInt(process.env.MYSQL_PORT || process.env.DB_PORT || '3306', 10),
          user:     process.env.MYSQL_USER || process.env.DB_USERNAME || process.env.DB_USER || 'root',
          password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
          database: process.env.MYSQL_DATABASE || process.env.DB_DATABASE || process.env.DB_NAME || 'digital_menu',
          waitForConnections: true,
          connectionLimit: 10,
          decimalNumbers: true,
        }
    mysqlPool = mysql.createPool(config)
    dbType = 'mysql'
    mysqlPool.query('SELECT 1')
      .then(async () => {
        console.log('✅ Connected to MySQL')
        // Auto-create all tables and seed defaults on first boot
        try {
          const { initMySqlSchema, seedMySqlDefaults } = require('./schema-mysql')
          await initMySqlSchema(mysqlPool)
          await seedMySqlDefaults(mysqlPool)
          console.log('✅ MySQL schema and seed data ready')
        } catch (schemaErr) {
          console.warn('⚠️ MySQL schema init notice:', schemaErr.message)
        }
      })
      .catch(err => console.error('❌ MySQL connection failed:', err.message))
  } catch (err) {
    console.error('❌ Failed to load mysql2 driver:', err.message)
  }
}

if (dbType === 'none') {
  console.log('ℹ️  No DB env found — running in localStore (JSON) mode')
}
// ── MySQL query converter ─────────────────────────────────────────────────────
// Converts PostgreSQL $1/$2 params + ILIKE + ::cast syntax to MySQL equivalents
function toMySQL(sql, values = []) {
  const newValues = []
  let out = sql.replace(/\$([0-9]+)/g, (_, num) => {
    newValues.push(values[parseInt(num, 10) - 1] ?? null)
    return '?'
  })
  out = out.replace(/\bILIKE\b/gi, 'LIKE')
  out = out.replace(/::(date|float|int|text|boolean)\b/gi, '')
  return { sql: out, values: newValues }
}

// ── Universal query function ──────────────────────────────────────────────────
async function query(text, values = []) {
  // ── PostgreSQL path ──────────────────────────────────────────────────────
  if (dbType === 'postgres' && pgPool) {
    try {
      const res = await pgPool.query(text, values)
      res.recordset = res.rows
      return res
    } catch (err) {
      console.error('❌ PG query error:', err.message)
      throw err
    }
  }
  // ── MySQL path ───────────────────────────────────────────────────────────
  if (dbType === 'mysql' && mysqlPool) {
    try {
      const hasReturning = /\bRETURNING\b/i.test(text)

      if (!hasReturning) {
        const { sql, values: vals } = toMySQL(text, values)
        const [result] = await mysqlPool.query(sql, vals)
        if (Array.isArray(result)) {
          return { rows: result, recordset: result, rowCount: result.length }
        }
        return { rows: [], recordset: [], rowCount: result.affectedRows || 0, insertId: result.insertId }
      }

      // INSERT ... RETURNING *
      const ins = text.match(/^(INSERT\s+INTO\s+(`?[a-zA-Z0-9_]+`?)[^]*?)\s+RETURNING\s+(.+)$/i)
      if (ins) {
        const { sql, values: vals } = toMySQL(ins[1], values)
        const [r] = await mysqlPool.query(sql, vals)
        if (r.insertId) {
          const [rows] = await mysqlPool.query(`SELECT ${ins[3] === '*' ? '*' : ins[3]} FROM \`${ins[2].replace(/`/g,'')}\` WHERE id = ?`, [r.insertId])
          return { rows, recordset: rows, rowCount: rows.length }
        }
        return { rows: [], recordset: [], rowCount: 1 }
      }

      // UPDATE ... RETURNING *
      const upd = text.match(/^(UPDATE\s+(`?[a-zA-Z0-9_]+`?)\s+SET[\s\S]+?WHERE\s+[\s\S]+?)\s+RETURNING\s+(.+)$/i)
      if (upd) {
        const { sql, values: vals } = toMySQL(upd[1], values)
        await mysqlPool.query(sql, vals)
        // Re-fetch using the WHERE clause
        const whereStart = upd[1].toUpperCase().lastIndexOf('WHERE')
        const whereClause = upd[1].slice(whereStart + 6)
        const { sql: wSql, values: wVals } = toMySQL(whereClause, values)
        try {
          const [rows] = await mysqlPool.query(`SELECT ${upd[3]} FROM \`${upd[2].replace(/`/g,'')}\` WHERE ${wSql}`, wVals)
          return { rows, recordset: rows, rowCount: rows.length }
        } catch (_) {
          return { rows: [], recordset: [], rowCount: 1 }
        }
      }

      // Fallback — strip RETURNING and run
      const stripped = text.replace(/\s+RETURNING\s+[^;]+/i, '')
      const { sql, values: vals } = toMySQL(stripped, values)
      const [result] = await mysqlPool.query(sql, vals)
      return { rows: [], recordset: [], rowCount: result.affectedRows || 0 }
    } catch (err) {
      console.error('❌ MySQL query error:', err.message)
      throw err
    }
  }

  // ── No DB — throw so routes fall back to localStore ──────────────────────
  throw new Error('Database not configured or offline')
}

async function getPool() {
  return pgPool || mysqlPool
}

module.exports = {
  query,
  getPool,
  pool: pgPool || mysqlPool,
  dbType: () => dbType,
}
