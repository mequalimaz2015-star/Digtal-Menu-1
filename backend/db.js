const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

// Auto-detect which DB driver to use based on environment variables
const isSqlServer = Boolean(
  process.env.DB_CONNECTION && process.env.DB_CONNECTION.toLowerCase() === 'sqlserver'
)
const isMySQL = !isSqlServer && Boolean(
  process.env.MYSQL_HOST ||
  (process.env.DB_CONNECTION && process.env.DB_CONNECTION.toLowerCase() === 'mysql') ||
  (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('mysql'))
)
const isPostgres = !isSqlServer && !isMySQL && Boolean(
  process.env.DATABASE_URL ||
  process.env.PGHOST
)
let dbType = 'none'
let mysqlPool = null
let pgPool    = null
let mssqlPool = null   // SQL Server connection pool

// ── SQL Server ───────────────────────────────────────────────────────────────
if (isSqlServer) {
  try {
    const sql = require('mssql')
    // Use 127.0.0.1 + port 1433 directly — more reliable than named instance
    // on local machines where TCP/IP is enabled but named pipes may not resolve
    const config = {
      server:   '127.0.0.1',
      database: process.env.MSSQL_DATABASE || 'digital_menu',
      port:     parseInt(process.env.MSSQL_PORT || '1433', 10),
      user:     process.env.MSSQL_USER     || 'sa',
      password: process.env.MSSQL_PASSWORD || 'Digital@2024',
      options: {
        trustServerCertificate: true,
        enableArithAbort:       true,
      },
      pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
      connectionTimeout: 30000,
      requestTimeout:    30000,
    }
    mssqlPool = new sql.ConnectionPool(config)
    dbType = 'sqlserver'
    mssqlPool.connect()
      .then(async () => {
        console.log('✅ Connected to SQL Server (digital_menu)')
        try {
          const { initSqlServerSchema, seedSqlServerDefaults } = require('./schema-sqlserver')
          await initSqlServerSchema(mssqlPool)
          await seedSqlServerDefaults(mssqlPool)
          console.log('✅ SQL Server schema and seed data ready')
        } catch (schemaErr) {
          console.warn('⚠️ SQL Server schema init notice:', schemaErr.message)
        }
      })
      .catch(err => console.error('❌ SQL Server connection failed:', err.message))
    mssqlPool.on('error', err => console.error('❌ SQL Server pool error:', err.message))
  } catch (err) {
    console.error('❌ Failed to load mssql driver:', err.message)
  }
}

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
    // Always prefer individual vars over DATABASE_URL — passwords with special
    // characters (colons, @, etc.) break URL parsing in mysql2
    const config = {
      host:     process.env.MYSQL_HOST     || process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.MYSQL_PORT || process.env.DB_PORT || '3306', 10),
      user:     process.env.MYSQL_USER     || process.env.DB_USERNAME || process.env.DB_USER || 'root',
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
  // ── SQL Server path ──────────────────────────────────────────────────────
  if (dbType === 'sqlserver' && mssqlPool) {
    try {
      const sql = require('mssql')
      // mssqlPool is the ConnectionPool — after connect() it is usable directly
      const request = mssqlPool.request()

      // Convert PostgreSQL $1/$2 placeholders → @p1/@p2 for SQL Server
      // Also fix SQL dialect differences
      let mssqlText = text
        .replace(/\$([0-9]+)/g, (_, n) => `@p${n}`)                   // $1 → @p1
        .replace(/\bILIKE\b/gi, 'LIKE')                                // ILIKE → LIKE
        .replace(/::(date|float|int|text|boolean)\b/gi, '')            // remove pg casts
        .replace(/\bBOOLEAN\b/gi, 'BIT')                               // BOOLEAN → BIT
        .replace(/\bSERIAL\b/gi, 'INT IDENTITY(1,1)')                  // SERIAL → IDENTITY
        .replace(/\bTRUE\b/g, '1').replace(/\bFALSE\b/g, '0')        // standalone TRUE/FALSE
        .replace(/=\s*true\b/gi, '=1').replace(/=\s*false\b/gi, '=0') // col=true → col=1
        .replace(/\btrue\b/gi, '1').replace(/\bfalse\b/gi, '0')       // any remaining true/false
        .replace(/NOW\(\)/gi, 'GETDATE()')                             // NOW() → GETDATE()
        .replace(/CURDATE\(\)/gi, 'CAST(GETDATE() AS DATE)')           // CURDATE()

      // Convert LIMIT n → TOP n for SQL Server
      // Simple: SELECT ... LIMIT n  →  SELECT TOP n ...
      // With OFFSET: SELECT ... LIMIT n OFFSET m  →  SELECT ... OFFSET m ROWS FETCH NEXT n ROWS ONLY
      const limitWithOffset = mssqlText.match(/\bLIMIT\s+(\d+)\s+OFFSET\s+(\d+)/i)
      const limitOnly = !limitWithOffset && mssqlText.match(/\bLIMIT\s+(\d+)/i)

      if (limitWithOffset) {
        const [fullMatch, limitN, offsetN] = limitWithOffset
        mssqlText = mssqlText.replace(fullMatch, `OFFSET ${offsetN} ROWS FETCH NEXT ${limitN} ROWS ONLY`)
        // Ensure ORDER BY exists (required for OFFSET...FETCH)
        if (!/\bORDER BY\b/i.test(mssqlText)) {
          mssqlText = mssqlText.replace(/\bOFFSET\s+\d+\s+ROWS/i, 'ORDER BY (SELECT NULL) OFFSET 0 ROWS')
        }
      } else if (limitOnly) {
        const [fullMatch, limitN] = limitOnly
        mssqlText = mssqlText.replace(fullMatch, '') // remove LIMIT n
        // Insert TOP n right after SELECT (or SELECT DISTINCT)
        mssqlText = mssqlText.replace(/\b(SELECT\s+(?:DISTINCT\s+)?)/i, `$1TOP ${limitN} `)
      }

      // Remove any trailing semicolons
      mssqlText = mssqlText.replace(/;\s*$/, '')

      // Bind parameters: @p1, @p2, ...
      if (values && values.length) {
        values.forEach((val, i) => {
          // Auto-detect type
          if (val === null || val === undefined) {
            request.input(`p${i + 1}`, sql.NVarChar, null)
          } else if (val instanceof Date) {
            // Pass Date objects as ISO datetime strings
            request.input(`p${i + 1}`, sql.DateTime, val)
          } else if (typeof val === 'boolean') {
            request.input(`p${i + 1}`, sql.Bit, val ? 1 : 0)
          } else if (val === 1 || val === 0) {
            request.input(`p${i + 1}`, sql.Int, val)
          } else if (typeof val === 'number' && Number.isInteger(val)) {
            request.input(`p${i + 1}`, sql.Int, val)
          } else if (typeof val === 'number') {
            request.input(`p${i + 1}`, sql.Float, val)
          } else {
            request.input(`p${i + 1}`, sql.NVarChar(sql.MAX), String(val))
          }
        })
      }

      // Handle RETURNING * → OUTPUT INSERTED.*
      const hasReturning = /\bRETURNING\b/i.test(mssqlText)
      if (hasReturning) {
        // INSERT INTO table (...) VALUES (...) RETURNING *
        // → INSERT INTO table (...) OUTPUT INSERTED.* VALUES (...)
        mssqlText = mssqlText.replace(
          /(INSERT\s+INTO\s+\S+\s*\([^)]+\))\s*(?:VALUES|SELECT)/i,
          (match, beforeValues) => {
            const keyword = match.slice(beforeValues.length).trim().split(/\s/)[0]
            return `${beforeValues} OUTPUT INSERTED.* ${keyword}`
          }
        ).replace(/\s*RETURNING\s+[\w\s,*]+/gi, '')

        // UPDATE table SET ... WHERE ... RETURNING *
        // → UPDATE table SET ... OUTPUT INSERTED.* WHERE ...
        mssqlText = mssqlText.replace(
          /(UPDATE\s+\S+\s+SET\s+[\s\S]+?)\s+(WHERE\s+[\s\S]+?)\s*RETURNING\s+[\w\s,*]+/gi,
          (_, setClause, whereClause) => `${setClause} OUTPUT INSERTED.* ${whereClause}`
        )
      }

      const result = await request.query(mssqlText)
      const rows = result.recordset || []

      // For plain INSERT (no OUTPUT/RETURNING), get the last inserted ID via SCOPE_IDENTITY
      let insertId = rows[0]?.id ? Number(rows[0].id) : 0
      if (!insertId && !hasReturning && /^\s*INSERT\s+/i.test(text)) {
        try {
          const idResult = await mssqlPool.request().query('SELECT SCOPE_IDENTITY() AS id')
          const scopeId = idResult.recordset[0]?.id
          if (scopeId) insertId = Number(scopeId)
        } catch (_) {}
      }

      return {
        rows,
        recordset: rows,
        rowCount: rows.length || result.rowsAffected?.[0] || 0,
        insertId,
      }
    } catch (err) {
      console.error('❌ SQL Server query error:', err.message, '\nSQL:', text.slice(0, 200))
      throw err
    }
  }

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
        const tableName = ins[2].replace(/`/g, '')
        const selectCols = ins[3] === '*' ? '*' : ins[3]
        const { sql, values: vals } = toMySQL(ins[1], values)
        const [r] = await mysqlPool.query(sql, vals)
        if (r.insertId) {
          const [rows] = await mysqlPool.query(
            `SELECT ${selectCols} FROM \`${tableName}\` WHERE id = ?`, [r.insertId]
          )
          return { rows, recordset: rows, rowCount: rows.length, insertId: r.insertId }
        }
        // insertId was 0 — try to find the row by the last inserted id
        const [lastRows] = await mysqlPool.query(
          `SELECT ${selectCols} FROM \`${tableName}\` ORDER BY id DESC LIMIT 1`
        )
        if (lastRows.length > 0) {
          return { rows: lastRows, recordset: lastRows, rowCount: lastRows.length, insertId: lastRows[0].id }
        }
        return { rows: [], recordset: [], rowCount: 1 }
      }

      // UPDATE ... RETURNING *
      const upd = text.match(/^(UPDATE\s+(`?[a-zA-Z0-9_]+`?)\s+SET[\s\S]+?WHERE\s+[\s\S]+?)\s+RETURNING\s+(.+)$/i)
      if (upd) {
        const { sql, values: vals } = toMySQL(upd[1], values)
        await mysqlPool.query(sql, vals)

        // Re-fetch the updated row: find WHERE clause $N placeholders and
        // map them to the correct original values[] indices (1-based $N → values[N-1])
        const whereStart = upd[1].toUpperCase().lastIndexOf('WHERE')
        const whereClause = upd[1].slice(whereStart + 6).trim()

        // Extract all $N indices referenced in the WHERE clause
        const whereIndices = []
        whereClause.replace(/\$([0-9]+)/g, (_, n) => { whereIndices.push(parseInt(n, 10)) })

        // Build the WHERE SQL with ? placeholders and correct values
        const whereSql = whereClause.replace(/\$([0-9]+)/g, '?')
        const whereVals = whereIndices.map(n => values[n - 1] ?? null)

        try {
          const [rows] = await mysqlPool.query(
            `SELECT ${upd[3] === '*' ? '*' : upd[3]} FROM \`${upd[2].replace(/`/g, '')}\` WHERE ${whereSql}`,
            whereVals
          )
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
  return mssqlPool || pgPool || mysqlPool
}

module.exports = {
  query,
  getPool,
  pool: mssqlPool || pgPool || mysqlPool,
  dbType: () => dbType,
}
