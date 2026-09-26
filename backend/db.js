const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

// ─── Detect which DB driver to use ───────────────────────────────────────────
// Priority:
//   1. DATABASE_URL (mysql:// or postgres://)
//   2. DB_CONNECTION=mysql + individual host/port/user/pass/db vars (AltCloud)
//   3. MYSQL_HOST / MYSQL_USER  (common container env)
//   4. PGHOST (PostgreSQL)
//   5. None → localStore fallback

const DB_URL = process.env.DATABASE_URL || ''

const isExplicitMySQL = Boolean(
  DB_URL.startsWith('mysql') ||
  (process.env.DB_CONNECTION && process.env.DB_CONNECTION.toLowerCase() === 'mysql') ||
  process.env.MYSQL_HOST ||
  (process.env.DB_HOST && !DB_URL.startsWith('postgres'))
)

const isExplicitPostgres = Boolean(
  !isExplicitMySQL &&
  (DB_URL.startsWith('postgres') || process.env.PGHOST)
)

let dbType = 'none'
let mysqlPool = null
let pgPool = null

if (isExplicitMySQL) {
  try {
    const mysql = require('mysql2/promise')

    if (DB_URL.startsWith('mysql')) {
      mysqlPool = mysql.createPool(DB_URL)
    } else {
      const host     = process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost'
      const port     = parseInt(process.env.MYSQL_PORT || process.env.DB_PORT || '3306', 10)
      const user     = process.env.MYSQL_USER || process.env.DB_USERNAME || process.env.DB_USER || 'admin_digtal_menu'
      const password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || ''
      const database = process.env.MYSQL_DATABASE || process.env.DB_DATABASE || process.env.DB_NAME || 'digtal_menu'

      mysqlPool = mysql.createPool({
        host, port, user, password, database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        decimalNumbers: true,
        typeCast (field, next) {
          // Convert MySQL TINYINT(1) to boolean
          if (field.type === 'TINY' && field.length === 1) return field.string() === '1'
          return next()
        }
      })
    }

    dbType = 'mysql'
    console.log(`🔌 Connecting to MySQL…`)

    mysqlPool.query('SELECT 1').then(async () => {
      console.log('✅ Connected to MySQL')
      try {
        const { initMySqlSchema, seedMySqlDefaults } = require('./schema-mysql')
        await initMySqlSchema(mysqlPool)
        await seedMySqlDefaults(mysqlPool)
        console.log('✅ MySQL schema & seed data ready!')
      } catch (e) {
        console.warn('⚠️ MySQL schema init notice:', e.message)
      }
    }).catch(err => {
      console.error('❌ DB connection failed:', err.message)
      console.log('ℹ️ Falling back to resilient localStore (JSON) mode.')
    })
  } catch (e) {
    console.error('❌ mysql2 load error:', e.message)
  }
} else if (isExplicitPostgres) {
  try {
    const { Pool } = require('pg')
    pgPool = new Pool({
      connectionString: DB_URL,
      ssl: DB_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 30000,
      max: 10
    })
    dbType = 'postgres'
    pgPool.on('error', err => console.error('❌ PG pool error:', err.message))
    pgPool.query('SELECT 1')
      .then(() => console.log('✅ Connected to PostgreSQL'))
      .catch(err => console.error('❌ DB connection failed:', err.message))
  } catch (e) {
    console.error('❌ pg load error:', e.message)
  }
} else {
  console.log('ℹ️ No DATABASE_URL set. Running in resilient localStore (JSON) mode.')
}

// ─── PG→MySQL SQL translation ─────────────────────────────────────────────────
function convertToMySQL (text, values = []) {
  const newVals = []
  let sql = text.replace(/\$([0-9]+)/g, (_, n) => {
    newVals.push(values[parseInt(n, 10) - 1] ?? null)
    return '?'
  })
  sql = sql.replace(/\bILIKE\b/gi, 'LIKE')
  sql = sql.replace(/::(date|float|int|text|bigint)\b/gi, '')
  return { sql, values: newVals }
}

// ─── RETURNING * handler for MySQL ───────────────────────────────────────────
async function runReturning (text, values) {
  const insertM = text.match(/^(INSERT\s+INTO\s+(`?[a-zA-Z0-9_]+`?)[^]*?)\s+RETURNING\s+(.+)$/is)
  if (insertM) {
    const table = insertM[2].replace(/`/g, '')
    const { sql, values: v } = convertToMySQL(insertM[1], values)
    const [res] = await mysqlPool.query(sql, v)
    if (res.insertId) {
      const cols = insertM[3].trim() === '*' ? '*' : insertM[3].trim()
      const [rows] = await mysqlPool.query(`SELECT ${cols} FROM \`${table}\` WHERE id = ?`, [res.insertId])
      return { rows, recordset: rows, rowCount: rows.length, insertId: res.insertId }
    }
    return { rows: [], recordset: [], rowCount: 1, insertId: res.insertId }
  }

  const updateM = text.match(/^(UPDATE\s+(`?[a-zA-Z0-9_]+`?)\s+SET\s+[^]+WHERE\s+[^]+?)\s+RETURNING\s+(.+)$/is)
  if (updateM) {
    const table = updateM[2].replace(/`/g, '')
    const { sql, values: v } = convertToMySQL(updateM[1], values)
    await mysqlPool.query(sql, v)
    // Re-fetch using the WHERE portion only
    const whereM = sql.match(/WHERE\s+(.+)$/is)
    if (whereM) {
      const cols = updateM[3].trim() === '*' ? '*' : updateM[3].trim()
      const [rows] = await mysqlPool.query(`SELECT ${cols} FROM \`${table}\` WHERE ${whereM[1]}`, v.slice(-whereM[1].split('?').length + 1)).catch(() => [[]])
      return { rows, recordset: rows, rowCount: rows.length }
    }
    return { rows: [], recordset: [], rowCount: 1 }
  }

  const deleteM = text.match(/^(DELETE\s+FROM\s+[^]+?)\s+RETURNING\s+.+$/is)
  if (deleteM) {
    const { sql, values: v } = convertToMySQL(deleteM[1], values)
    const [res] = await mysqlPool.query(sql, v)
    return { rows: [], recordset: [], rowCount: res.affectedRows || 0 }
  }

  // Fallback: strip RETURNING and just run
  const stripped = text.replace(/\s+RETURNING\s+.+$/is, '')
  const { sql, values: v } = convertToMySQL(stripped, values)
  const [res] = await mysqlPool.query(sql, v)
  return { rows: [], recordset: [], rowCount: res.affectedRows || 0 }
}

// ─── Universal query() ────────────────────────────────────────────────────────
async function query (text, values = []) {
  if (dbType === 'mysql' && mysqlPool) {
    try {
      if (/\bRETURNING\b/i.test(text)) return await runReturning(text, values)
      const { sql, values: v } = convertToMySQL(text, values)
      const [result] = await mysqlPool.query(sql, v)
      if (Array.isArray(result)) return { rows: result, recordset: result, rowCount: result.length }
      return { rows: [], recordset: [], rowCount: result.affectedRows || 0, insertId: result.insertId }
    } catch (err) {
      console.error('❌ MySQL query error:', err.message, '|', text.slice(0, 80))
      throw err
    }
  }

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

  throw new Error('Database not configured or currently offline')
}

async function getPool () { return mysqlPool || pgPool }

module.exports = {
  query,
  getPool,
  pool: mysqlPool || pgPool,
  dbType: () => dbType
}
