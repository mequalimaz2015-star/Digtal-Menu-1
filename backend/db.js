/**
 * db.js — SQL Server only
 *
 * Connects to SQL Server using mssql.
 * All connection params come from environment variables.
 *
 * Local (SQLEXPRESS):
 *   DB_CONNECTION=sqlserver
 *   MSSQL_SERVER=localhost\SQLEXPRESS
 *   MSSQL_DATABASE=digital_menu
 *   MSSQL_USER=sa              (or leave blank for Windows Auth)
 *   MSSQL_PASSWORD=your_pass
 *
 * AletCloud (Azure SQL or any cloud SQL Server):
 *   DB_CONNECTION=sqlserver
 *   MSSQL_SERVER=your-server.database.windows.net
 *   MSSQL_DATABASE=digital_menu
 *   MSSQL_USER=your_user
 *   MSSQL_PASSWORD=your_password
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

const sql = require('mssql')

// ── Build connection config from env vars ─────────────────────────────────────
function buildConfig() {
  const server   = process.env.MSSQL_SERVER   || process.env.DB_SERVER   || 'localhost\\SQLEXPRESS'
  const database = process.env.MSSQL_DATABASE || process.env.DB_NAME     || 'digital_menu'
  const user     = process.env.MSSQL_USER     || process.env.DB_USER     || ''
  const password = process.env.MSSQL_PASSWORD || process.env.DB_PASSWORD || ''
  const port     = parseInt(process.env.MSSQL_PORT || process.env.DB_PORT || '1433', 10)

  const config = {
    server,
    database,
    port,
    options: {
      trustServerCertificate: true,
      enableArithAbort: true,
      encrypt: false, // set to true for Azure SQL / cloud deployments
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    connectionTimeout: 30000,
    requestTimeout:    30000,
  }

  // Only add auth if credentials provided; otherwise Windows Auth is used
  if (user && password) {
    config.user     = user
    config.password = password
  }

  return config
}

// ── Connection pool (singleton) ───────────────────────────────────────────────
let pool = null

async function getPool() {
  if (pool) return pool

  const config = buildConfig()
  console.log(`🔌 Connecting to SQL Server: ${config.server}/${config.database}`)

  pool = new sql.ConnectionPool(config)

  pool.on('error', err => {
    console.error('❌ SQL Server pool error:', err.message)
    pool = null // allow reconnect on next query
  })

  await pool.connect()
  console.log(`✅ SQL Server connected: ${config.server}/${config.database}`)

  // Auto-create tables and seed defaults on first connect
  try {
    const { initSqlServerSchema, seedSqlServerDefaults } = require('./schema-sqlserver')
    await initSqlServerSchema(pool)
    await seedSqlServerDefaults(pool)
    console.log('✅ SQL Server schema and seed data ready')
  } catch (schemaErr) {
    console.warn('⚠️  Schema init notice:', schemaErr.message)
  }

  return pool
}

// ── Convert PostgreSQL-style $1/$2 params → @p1/@p2 for mssql ─────────────────
// Also handles common SQL dialect differences
function convertQuery(text, values = []) {
  let out = text
    // $1 → @p1
    .replace(/\$([0-9]+)/g, (_, n) => `@p${n}`)
    // ILIKE → LIKE
    .replace(/\bILIKE\b/gi, 'LIKE')
    // pg casts ::type
    .replace(/::(date|float|int|text|boolean)\b/gi, '')
    // TRUE/FALSE literals
    .replace(/=\s*true\b/gi, '=1').replace(/=\s*false\b/gi, '=0')
    .replace(/\btrue\b/gi,  '1').replace(/\bfalse\b/gi, '0')
    // NOW() → GETDATE()
    .replace(/\bNOW\(\)/gi, 'GETDATE()')
    // BOOLEAN type in DDL
    .replace(/\bBOOLEAN\b/gi, 'BIT')

  // LIMIT n OFFSET m  →  OFFSET m ROWS FETCH NEXT n ROWS ONLY
  const limitOffset = out.match(/\bLIMIT\s+(\d+)\s+OFFSET\s+(\d+)/i)
  if (limitOffset) {
    out = out.replace(limitOffset[0], `OFFSET ${limitOffset[2]} ROWS FETCH NEXT ${limitOffset[1]} ROWS ONLY`)
    if (!/\bORDER BY\b/i.test(out)) {
      out = out.replace(/OFFSET\s+\d+\s+ROWS/i, 'ORDER BY (SELECT NULL) OFFSET 0 ROWS')
    }
  } else {
    // LIMIT n  →  TOP n  (insert after SELECT)
    const limitOnly = out.match(/\bLIMIT\s+(\d+)/i)
    if (limitOnly) {
      out = out.replace(limitOnly[0], '')
      out = out.replace(/\b(SELECT\s+(?:DISTINCT\s+)?)/i, `$1TOP ${limitOnly[1]} `)
    }
  }

  // Remove trailing semicolons
  out = out.replace(/;\s*$/, '')

  return out
}

// ── Bind parameters to a request ─────────────────────────────────────────────
function bindParams(request, values = []) {
  values.forEach((val, i) => {
    const name = `p${i + 1}`
    if (val === null || val === undefined) {
      request.input(name, sql.NVarChar, null)
    } else if (val instanceof Date) {
      request.input(name, sql.DateTime, val)
    } else if (typeof val === 'boolean') {
      request.input(name, sql.Bit, val ? 1 : 0)
    } else if (typeof val === 'number' && Number.isInteger(val)) {
      request.input(name, sql.Int, val)
    } else if (typeof val === 'number') {
      request.input(name, sql.Float, val)
    } else {
      request.input(name, sql.NVarChar(sql.MAX), String(val))
    }
  })
}

// ── Universal query function ──────────────────────────────────────────────────
// Accepts PostgreSQL $1/$2 syntax — converts automatically for SQL Server.
// Returns { rows, rowCount, insertId } — same shape all route files expect.
async function query(text, values = []) {
  const p = await getPool()

  const hasReturning = /\bRETURNING\b/i.test(text)

  // ── INSERT … RETURNING * ──────────────────────────────────────────────────
  if (hasReturning) {
    // Convert RETURNING * → OUTPUT INSERTED.*
    let mssqlText = text

    // INSERT … RETURNING
    const insMatch = mssqlText.match(
      /(INSERT\s+INTO\s+\S+\s*\([^)]+\))\s*(VALUES\s*\([^)]+\))\s*RETURNING\s+[\w\s,*]+/i
    )
    if (insMatch) {
      mssqlText = `${insMatch[1]} OUTPUT INSERTED.* ${insMatch[2]}`
    } else {
      // UPDATE … RETURNING
      mssqlText = mssqlText.replace(
        /(UPDATE\s+\S+\s+SET\s+[\s\S]+?)(WHERE\s+[\s\S]+?)\s*RETURNING\s+[\w\s,*]+/gi,
        '$1 OUTPUT INSERTED.* $2'
      )
      if (mssqlText === text) {
        // Generic fallback — strip RETURNING
        mssqlText = mssqlText.replace(/\s*RETURNING\s+[\w\s,*]+/gi, '')
      }
    }

    const converted = convertQuery(mssqlText, values)
    const req = p.request()
    bindParams(req, values)
    try {
      const result = await req.query(converted)
      const rows = result.recordset || []
      return { rows, recordset: rows, rowCount: rows.length, insertId: rows[0]?.id || 0 }
    } catch (err) {
      console.error('❌ SQL Server query error (RETURNING):', err.message, '\nSQL:', converted.slice(0, 300))
      throw err
    }
  }

  // ── Regular query ─────────────────────────────────────────────────────────
  const converted = convertQuery(text, values)
  const req = p.request()
  bindParams(req, values)

  try {
    const result = await req.query(converted)
    const rows = result.recordset || []

    // For INSERT without RETURNING, fetch the last inserted ID
    let insertId = 0
    if (/^\s*INSERT\s+/i.test(text)) {
      try {
        const idRes = await p.request().query('SELECT SCOPE_IDENTITY() AS id')
        insertId = Number(idRes.recordset[0]?.id || 0)
      } catch (_) {}
    }

    return {
      rows,
      recordset: rows,
      rowCount:  result.rowsAffected?.[0] ?? rows.length,
      insertId,
    }
  } catch (err) {
    console.error('❌ SQL Server query error:', err.message, '\nSQL:', converted.slice(0, 300))
    throw err
  }
}

// ── Initialise on startup (don't await — server starts immediately) ───────────
getPool().catch(err => {
  console.error('❌ SQL Server initial connection failed:', err.message)
  console.error('   Check MSSQL_SERVER, MSSQL_DATABASE, MSSQL_USER, MSSQL_PASSWORD in .env')
})

module.exports = { query, getPool, dbType: () => 'sqlserver' }
