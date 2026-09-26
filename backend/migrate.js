/**
 * migrate.js
 * Runs the multi-tenant schema migration.
 * Supports both PostgreSQL (pool.connect) and MySQL (initMySqlSchema).
 * Usage: node migrate.js
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

async function runMigration() {
  console.log('🚀 Running Multi-Tenant Schema Migration...')

  const isMySQL = Boolean(
    process.env.MYSQL_HOST ||
    (process.env.DB_CONNECTION && process.env.DB_CONNECTION.toLowerCase() === 'mysql') ||
    (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('mysql'))
  )

  // ── MySQL path ─────────────────────────────────────────────────────────────
  if (isMySQL) {
    console.log('🔌 Using MySQL driver...')
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
            connectionLimit: 5,
            multipleStatements: true,
          }

      const pool = mysql.createPool(config)

      // Verify connection
      await pool.query('SELECT 1')
      console.log('✅ Connected to MySQL')

      const { initMySqlSchema, seedMySqlDefaults } = require('./schema-mysql')
      await initMySqlSchema(pool)
      console.log('✅ MySQL tables created/verified')
      await seedMySqlDefaults(pool)
      console.log('✅ MySQL seed data applied')

      await pool.end()
      console.log('🎉 Migration completed successfully!')
      process.exit(0)
    } catch (err) {
      console.error('❌ MySQL migration failed:', err.message)
      process.exit(1)
    }
  }

  // ── PostgreSQL path ────────────────────────────────────────────────────────
  console.log('🔌 Using PostgreSQL driver...')
  try {
    const { Pool } = require('pg')
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
        ? false
        : { rejectUnauthorized: false },
    })

    const fs = require('fs')
    const migrationSqlPath = path.join(__dirname, 'migrations', '001_multi_tenant_schema.sql')
    const sql = fs.readFileSync(migrationSqlPath, 'utf8')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('COMMIT')
      console.log('✅ PostgreSQL migration completed successfully!')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    await pool.end()
    console.log('🎉 Migration completed successfully!')
    process.exit(0)
  } catch (err) {
    console.error('❌ PostgreSQL migration failed:', err.message)
    process.exit(1)
  }
}

runMigration()
