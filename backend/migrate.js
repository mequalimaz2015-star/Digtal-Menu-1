const fs = require('fs')
const path = require('path')
const { pool } = require('./db')

async function runMigration() {
  console.log('🚀 Running Multi-Tenant Schema Migration...')
  const client = await pool.connect()
  try {
    const migrationSqlPath = path.join(__dirname, 'migrations', '001_multi_tenant_schema.sql')
    const sql = fs.readFileSync(migrationSqlPath, 'utf8')
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
    console.log('✅ Multi-Tenant Schema Migration completed successfully!')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Migration failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    process.exit(0)
  }
}

runMigration()
