/**
 * setup-sqlserver.js
 * Run once to create the digital_menu database + all tables + seed data.
 * Usage:  node setup-sqlserver.js
 */
const sql = require('mssql')
const bcrypt = require('bcryptjs')

// ── Connect to master first (to create the database) ─────────────────────────
const masterConfig = {
  server: 'localhost\\SQLEXPRESS',
  database: 'master',
  port: 1433,
  options: {
    trustServerCertificate: true,
    enableArithAbort: true,
    trustedConnection: false,
  },
  authentication: {
    type: 'default',
    options: { userName: '', password: '' }
  },
  pool: { max: 5, min: 0, idleTimeoutMillis: 10000 },
}

// Try Windows Auth first, fall back to SQL Auth
async function getConnection(database = 'master') {
  const configs = [
    // Option 1: localhost with instance name, Windows Auth
    {
      server: 'localhost',
      database,
      port: 1433,
      options: { trustServerCertificate: true, enableArithAbort: true, instanceName: 'SQLEXPRESS' },
      authentication: { type: 'default', options: { userName: '', password: '' } },
      pool: { max: 5, min: 0, idleTimeoutMillis: 10000 },
    },
    // Option 2: 127.0.0.1 direct IP, Windows Auth
    {
      server: '127.0.0.1',
      database,
      port: 1433,
      options: { trustServerCertificate: true, enableArithAbort: true },
      authentication: { type: 'default', options: { userName: '', password: '' } },
      pool: { max: 5, min: 0, idleTimeoutMillis: 10000 },
    },
    // Option 2b: 127.0.0.1 with SA login
    {
      server: '127.0.0.1',
      database,
      port: 1433,
      user: 'sa',
      password: process.env.MSSQL_PASSWORD || 'Digital@2024',
      options: { trustServerCertificate: true, enableArithAbort: true },
      pool: { max: 5, min: 0, idleTimeoutMillis: 10000 },
    },
    // Option 2c: localhost with SA login
    {
      server: 'localhost',
      database,
      port: 1433,
      user: 'sa',
      password: process.env.MSSQL_PASSWORD || 'Digital@2024',
      options: { trustServerCertificate: true, enableArithAbort: true },
      pool: { max: 5, min: 0, idleTimeoutMillis: 10000 },
    },
    // Option 3: localhost\SQLEXPRESS with integratedSecurity
    {
      server: 'localhost\\SQLEXPRESS',
      database,
      port: 1433,
      options: {
        trustServerCertificate: true,
        enableArithAbort: true,
        integratedSecurity: true,
      },
      pool: { max: 5, min: 0, idleTimeoutMillis: 10000 },
    },
    // Option 4: named instance via instanceName
    {
      server: 'localhost',
      database,
      options: {
        trustServerCertificate: true,
        enableArithAbort: true,
        instanceName: 'SQLEXPRESS',
      },
      authentication: { type: 'default', options: { userName: '', password: '' } },
      pool: { max: 5, min: 0, idleTimeoutMillis: 10000 },
    },
  ]

  for (let i = 0; i < configs.length; i++) {
    try {
      console.log(`  Trying connection option ${i + 1}...`)
      const pool = await new sql.ConnectionPool(configs[i]).connect()
      console.log(`✅ Connected! (option ${i + 1}, ${database})`)
      return pool
    } catch (e) {
      console.log(`  Option ${i + 1} failed: ${e.message.split('\n')[0]}`)
    }
  }
  throw new Error('All connection options failed. See troubleshooting above.')
}

async function run() {
  console.log('\n🚀 Digital Menu — SQL Server Setup\n' + '─'.repeat(50))

  // ── Step 1: Create the database ────────────────────────────────────────────
  console.log('\n📁 Step 1: Creating database digital_menu...')
  const master = await getConnection('master')
  await master.request().query(`
    IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'digital_menu')
    BEGIN
      CREATE DATABASE digital_menu;
      PRINT 'Created digital_menu';
    END
  `)
  console.log('✅ Database digital_menu ready')
  await master.close()

  // ── Step 2: Connect to digital_menu and create tables ──────────────────────
  console.log('\n📋 Step 2: Creating tables...')
  const db = await getConnection('digital_menu')

  const tables = [
    // subscription_plans
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='subscription_plans' AND xtype='U')
    CREATE TABLE subscription_plans (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(100) NOT NULL,
      description NVARCHAR(MAX),
      price_etb FLOAT NOT NULL DEFAULT 0,
      billing_interval NVARCHAR(20) DEFAULT 'monthly',
      max_menu_items INT DEFAULT 30,
      max_tables INT DEFAULT 10,
      max_orders_per_month INT DEFAULT 500,
      max_staff_accounts INT DEFAULT 3,
      delivery_enabled BIT DEFAULT 0,
      white_label_enabled BIT DEFAULT 0,
      analytics_enabled BIT DEFAULT 1,
      is_active BIT DEFAULT 1,
      created_at DATETIME DEFAULT GETDATE()
    )`,

    // tenants
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tenants' AND xtype='U')
    CREATE TABLE tenants (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(200) NOT NULL,
      name_am NVARCHAR(200),
      slug NVARCHAR(100) NOT NULL,
      tagline NVARCHAR(300),
      description NVARCHAR(MAX),
      logo_url NVARCHAR(500),
      cover_url NVARCHAR(500),
      address NVARCHAR(500),
      phone NVARCHAR(50),
      email NVARCHAR(200),
      wifi_password NVARCHAR(100),
      working_hours NVARCHAR(200),
      vat_rate FLOAT DEFAULT 0.15,
      service_charge_rate FLOAT DEFAULT 0.10,
      currency NVARCHAR(10) DEFAULT 'ETB',
      status NVARCHAR(30) DEFAULT 'active',
      subscription_plan_id INT,
      subscription_status NVARCHAR(30) DEFAULT 'active',
      trial_ends_at DATETIME,
      created_at DATETIME DEFAULT GETDATE(),
      updated_at DATETIME DEFAULT GETDATE()
    )`,

    // unique index on tenants.slug
    `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='UQ_tenants_slug')
    ALTER TABLE tenants ADD CONSTRAINT UQ_tenants_slug UNIQUE (slug)`,

    // users
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
    CREATE TABLE users (
      id INT IDENTITY(1,1) PRIMARY KEY,
      tenant_id INT NULL,
      name NVARCHAR(200) NOT NULL DEFAULT '',
      email NVARCHAR(200) NOT NULL,
      password NVARCHAR(300) NOT NULL,
      role NVARCHAR(50) DEFAULT 'admin',
      phone NVARCHAR(50),
      is_active BIT DEFAULT 1,
      created_at DATETIME DEFAULT GETDATE()
    )`,

    `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='UQ_users_email')
    ALTER TABLE users ADD CONSTRAINT UQ_users_email UNIQUE (email)`,

    // categories
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='categories' AND xtype='U')
    CREATE TABLE categories (
      id INT IDENTITY(1,1) PRIMARY KEY,
      tenant_id INT NULL,
      name NVARCHAR(100) NOT NULL,
      name_am NVARCHAR(100),
      icon NVARCHAR(20),
      color NVARCHAR(30),
      sort_order INT DEFAULT 0,
      is_active BIT DEFAULT 1,
      created_at DATETIME DEFAULT GETDATE()
    )`,

    // menu_items
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='menu_items' AND xtype='U')
    CREATE TABLE menu_items (
      id INT IDENTITY(1,1) PRIMARY KEY,
      tenant_id INT NULL,
      category_id INT NULL,
      name NVARCHAR(200) NOT NULL,
      name_am NVARCHAR(200),
      description NVARCHAR(MAX),
      description_am NVARCHAR(MAX),
      price FLOAT NOT NULL,
      image_url NVARCHAR(500),
      prep_time INT DEFAULT 15,
      is_spicy BIT DEFAULT 0,
      is_vegetarian BIT DEFAULT 0,
      is_available BIT DEFAULT 1,
      is_featured BIT DEFAULT 0,
      is_popular BIT DEFAULT 0,
      is_best_seller BIT DEFAULT 0,
      chef_recommended BIT DEFAULT 0,
      rating FLOAT DEFAULT 4.5,
      review_count INT DEFAULT 0,
      calories INT,
      discount FLOAT DEFAULT 0,
      allergens NVARCHAR(500),
      menu_item_ref NVARCHAR(20),
      created_at DATETIME DEFAULT GETDATE()
    )`,

    // modifier_groups
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='modifier_groups' AND xtype='U')
    CREATE TABLE modifier_groups (
      id INT IDENTITY(1,1) PRIMARY KEY,
      tenant_id INT NULL,
      name NVARCHAR(200) NOT NULL,
      name_am NVARCHAR(200),
      required BIT DEFAULT 0,
      multi_select BIT DEFAULT 0,
      max_select INT DEFAULT 1,
      created_at DATETIME DEFAULT GETDATE()
    )`,

    // modifiers
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='modifiers' AND xtype='U')
    CREATE TABLE modifiers (
      id INT IDENTITY(1,1) PRIMARY KEY,
      group_id INT NOT NULL,
      name NVARCHAR(200) NOT NULL,
      name_am NVARCHAR(200),
      price FLOAT DEFAULT 0,
      is_available BIT DEFAULT 1
    )`,

    // tables
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tables' AND xtype='U')
    CREATE TABLE tables (
      id INT IDENTITY(1,1) PRIMARY KEY,
      tenant_id INT NULL,
      number NVARCHAR(20) NOT NULL,
      capacity INT DEFAULT 4,
      status NVARCHAR(20) DEFAULT 'available',
      created_at DATETIME DEFAULT GETDATE()
    )`,

    // delivery_zones
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='delivery_zones' AND xtype='U')
    CREATE TABLE delivery_zones (
      id INT IDENTITY(1,1) PRIMARY KEY,
      tenant_id INT NOT NULL,
      zone_name NVARCHAR(100) NOT NULL,
      min_order_amount FLOAT DEFAULT 0,
      delivery_fee FLOAT DEFAULT 0,
      estimated_delivery_minutes INT DEFAULT 45,
      is_active BIT DEFAULT 1,
      created_at DATETIME DEFAULT GETDATE()
    )`,

    // orders
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='orders' AND xtype='U')
    CREATE TABLE orders (
      id INT IDENTITY(1,1) PRIMARY KEY,
      tenant_id INT NULL,
      user_id INT NULL,
      order_ref NVARCHAR(50) NOT NULL,
      table_number NVARCHAR(20),
      customer_name NVARCHAR(200),
      phone NVARCHAR(50),
      notes NVARCHAR(MAX),
      status NVARCHAR(20) DEFAULT 'new',
      subtotal FLOAT,
      vat FLOAT,
      service_charge FLOAT,
      grand_total FLOAT,
      estimated_time INT DEFAULT 20,
      order_type NVARCHAR(20) DEFAULT 'dine_in',
      pickup_number NVARCHAR(20),
      pickup_time NVARCHAR(50),
      delivery_address NVARCHAR(MAX),
      delivery_lat FLOAT,
      delivery_lng FLOAT,
      delivery_zone_id INT NULL,
      rider_id INT NULL,
      delivery_fee FLOAT DEFAULT 0,
      delivery_status NVARCHAR(50) DEFAULT 'pending',
      payment_method NVARCHAR(50) DEFAULT 'cash',
      payment_status NVARCHAR(50) DEFAULT 'pending',
      payment_tx_ref NVARCHAR(100),
      session_id NVARCHAR(100) NULL,
      created_at DATETIME DEFAULT GETDATE(),
      updated_at DATETIME DEFAULT GETDATE()
    )`,

    `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='UQ_orders_ref')
    ALTER TABLE orders ADD CONSTRAINT UQ_orders_ref UNIQUE (order_ref)`,

    // order_items
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='order_items' AND xtype='U')
    CREATE TABLE order_items (
      id INT IDENTITY(1,1) PRIMARY KEY,
      order_id INT NULL,
      menu_item_name NVARCHAR(200),
      price FLOAT,
      quantity INT,
      modifiers NVARCHAR(MAX),
      special_instructions NVARCHAR(MAX),
      item_total FLOAT
    )`,

    // reviews
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='reviews' AND xtype='U')
    CREATE TABLE reviews (
      id INT IDENTITY(1,1) PRIMARY KEY,
      tenant_id INT NULL,
      order_ref NVARCHAR(50),
      table_number NVARCHAR(20),
      customer_name NVARCHAR(200),
      phone NVARCHAR(50),
      overall_rating INT,
      food_rating INT,
      service_rating INT,
      comment NVARCHAR(MAX),
      created_at DATETIME DEFAULT GETDATE()
    )`,

    // waiter_calls
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='waiter_calls' AND xtype='U')
    CREATE TABLE waiter_calls (
      id INT IDENTITY(1,1) PRIMARY KEY,
      tenant_id INT NULL,
      table_number NVARCHAR(20) NOT NULL,
      type NVARCHAR(50) DEFAULT 'service',
      status NVARCHAR(20) DEFAULT 'pending',
      created_at DATETIME DEFAULT GETDATE(),
      resolved_at DATETIME NULL
    )`,

    // chat_messages
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='chat_messages' AND xtype='U')
    CREATE TABLE chat_messages (
      id INT IDENTITY(1,1) PRIMARY KEY,
      tenant_id INT NULL,
      session_id NVARCHAR(100) NOT NULL,
      sender NVARCHAR(50) NOT NULL,
      message NVARCHAR(MAX) NOT NULL,
      is_read BIT DEFAULT 0,
      created_at DATETIME DEFAULT GETDATE()
    )`,

    // audit_logs
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='audit_logs' AND xtype='U')
    CREATE TABLE audit_logs (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id INT NULL,
      tenant_id INT NULL,
      action NVARCHAR(100) NOT NULL,
      details NVARCHAR(MAX),
      ip_address NVARCHAR(50),
      created_at DATETIME DEFAULT GETDATE()
    )`,

    // announcements
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='announcements' AND xtype='U')
    CREATE TABLE announcements (
      id INT IDENTITY(1,1) PRIMARY KEY,
      title NVARCHAR(255) NOT NULL,
      content NVARCHAR(MAX) NOT NULL,
      priority NVARCHAR(20) DEFAULT 'normal',
      is_active BIT DEFAULT 1,
      created_at DATETIME DEFAULT GETDATE()
    )`,

    // platform_settings
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='platform_settings' AND xtype='U')
    CREATE TABLE platform_settings (
      setting_key NVARCHAR(100) PRIMARY KEY,
      setting_value NVARCHAR(MAX),
      updated_at DATETIME DEFAULT GETDATE()
    )`,

    // subscriptions
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='subscriptions' AND xtype='U')
    CREATE TABLE subscriptions (
      id INT IDENTITY(1,1) PRIMARY KEY,
      tenant_id INT NOT NULL,
      plan_id INT NOT NULL,
      status NVARCHAR(30) DEFAULT 'active',
      current_period_start DATETIME DEFAULT GETDATE(),
      current_period_end DATETIME,
      payment_provider NVARCHAR(50) DEFAULT 'chapa',
      payment_reference NVARCHAR(200),
      amount_paid FLOAT DEFAULT 0,
      created_at DATETIME DEFAULT GETDATE()
    )`,
  ]

  let created = 0
  for (const ddl of tables) {
    try {
      await db.request().query(ddl)
      created++
    } catch (e) {
      console.warn(`  ⚠️  Table notice: ${e.message.split('\n')[0]}`)
    }
  }
  console.log(`✅ ${created}/${tables.length} table statements executed`)

  // ── Step 3: Seed default data ───────────────────────────────────────────────
  console.log('\n🌱 Step 3: Seeding default data...')

  // Subscription plans
  const planCount = await db.request().query('SELECT COUNT(*) AS cnt FROM subscription_plans')
  if (planCount.recordset[0].cnt === 0) {
    await db.request().query(`
      INSERT INTO subscription_plans (name,description,price_etb,billing_interval,max_menu_items,max_tables,max_orders_per_month,max_staff_accounts,delivery_enabled,white_label_enabled,analytics_enabled) VALUES
      ('Free Trial','14-day free trial with standard digital menu features',0,'monthly',20,5,200,2,0,0,1),
      ('Basic Plan','Essential digital menu and QR ordering for small cafes',1500,'monthly',50,15,1000,5,0,0,1),
      ('Pro SaaS + Delivery','Complete digital restaurant suite with online delivery',3500,'monthly',9999,50,10000,20,1,1,1)
    `)
    console.log('  ✅ Subscription plans seeded')
  } else {
    console.log('  ✓  Subscription plans already exist')
  }

  // Default tenant
  const tenantCount = await db.request().query("SELECT COUNT(*) AS cnt FROM tenants WHERE slug='abc-restaurant'")
  if (tenantCount.recordset[0].cnt === 0) {
    await db.request().query(`
      INSERT INTO tenants (name,name_am,slug,tagline,address,phone,wifi_password,working_hours,cover_url,status,subscription_plan_id,subscription_status)
      VALUES (
        'ABC Restaurant','ኤቢሲ ምግብ ቤት','abc-restaurant',
        'Fine Dining & Fast Delivery',
        'Bole Road, Addis Ababa, Ethiopia',
        '+251 91 859 2028','ABCRest@2024',
        'Mon–Sun: 7:00 AM – 11:00 PM',
        'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80',
        'active',3,'active'
      )
    `)
    console.log('  ✅ Default tenant (ABC Restaurant) seeded')
  } else {
    console.log('  ✓  Default tenant already exists')
  }

  // Get tenant id=1
  const tenantRow = await db.request().query("SELECT TOP 1 id FROM tenants ORDER BY id")
  const tenantId = tenantRow.recordset[0]?.id || 1

  // Super admin
  const saCount = await db.request().query("SELECT COUNT(*) AS cnt FROM users WHERE email='superadmin@platform.com'")
  if (saCount.recordset[0].cnt === 0) {
    const saHash = await bcrypt.hash('superadmin123', 10)
    const req = db.request()
    req.input('hash', sql.NVarChar(300), saHash)
    await req.query("INSERT INTO users (name,email,password,role,is_active,tenant_id) VALUES ('Super Platform Owner','superadmin@platform.com',@hash,'super_admin',1,NULL)")
    console.log('  ✅ Super admin seeded  (superadmin@platform.com / superadmin123)')
  } else {
    console.log('  ✓  Super admin already exists')
  }

  // Restaurant admin
  const adminCount = await db.request().query("SELECT COUNT(*) AS cnt FROM users WHERE email='admin@abc.com'")
  if (adminCount.recordset[0].cnt === 0) {
    const adminHash = await bcrypt.hash('admin123', 10)
    const req = db.request()
    req.input('hash', sql.NVarChar(300), adminHash)
    req.input('tid', sql.Int, tenantId)
    await req.query("INSERT INTO users (name,email,password,role,is_active,tenant_id) VALUES ('Admin User','admin@abc.com',@hash,'admin',1,@tid)")
    console.log('  ✅ Restaurant admin seeded  (admin@abc.com / admin123)')
  } else {
    console.log('  ✓  Restaurant admin already exists')
  }

  // Categories
  const catCount = await db.request().query(`SELECT COUNT(*) AS cnt FROM categories WHERE tenant_id=${tenantId}`)
  if (catCount.recordset[0].cnt === 0) {
    const req = db.request()
    req.input('tid', sql.Int, tenantId)
    await req.query(`
      INSERT INTO categories (tenant_id,name,name_am,icon,color,sort_order) VALUES
      (@tid,'Breakfast','ቁርስ','🍳','#f48c06',0),
      (@tid,'Lunch','ምሳ','🥗','#2d9d4f',1),
      (@tid,'Dinner','እራት','🥩','#8b1a1a',2),
      (@tid,'Pizza','ፒዛ','🍕','#e85d04',3),
      (@tid,'Burger','በርገር','🍔','#d4a017',4),
      (@tid,'Pasta','ፓስታ','🍝','#c0392b',5),
      (@tid,'Drinks','መጠጦች','🥤','#2980b9',6),
      (@tid,'Desserts','ጣፋጭ','🍰','#e91e8c',7),
      (@tid,'Coffee','ቡና','☕','#6d4c41',8)
    `)
    console.log('  ✅ 9 categories seeded')
  } else {
    console.log('  ✓  Categories already exist')
  }

  // Tables
  const tableCount = await db.request().query(`SELECT COUNT(*) AS cnt FROM tables WHERE tenant_id=${tenantId}`)
  if (tableCount.recordset[0].cnt === 0) {
    const req = db.request()
    req.input('tid', sql.Int, tenantId)
    await req.query(`
      INSERT INTO tables (tenant_id,number,capacity) VALUES
      (@tid,'1',2),(@tid,'2',4),(@tid,'3',4),(@tid,'4',6),
      (@tid,'5',2),(@tid,'6',8),(@tid,'VIP 1',4),(@tid,'Terrace 1',6)
    `)
    console.log('  ✅ 8 tables seeded')
  } else {
    console.log('  ✓  Tables already exist')
  }

  // Delivery zones
  const dzCount = await db.request().query(`SELECT COUNT(*) AS cnt FROM delivery_zones WHERE tenant_id=${tenantId}`)
  if (dzCount.recordset[0].cnt === 0) {
    const req = db.request()
    req.input('tid', sql.Int, tenantId)
    await req.query(`
      INSERT INTO delivery_zones (tenant_id,zone_name,min_order_amount,delivery_fee,estimated_delivery_minutes) VALUES
      (@tid,'Bole & Around',200,100,30),
      (@tid,'Kazanchis & Kirkos',300,150,45),
      (@tid,'Piassa & Arada',400,200,50)
    `)
    console.log('  ✅ 3 delivery zones seeded')
  } else {
    console.log('  ✓  Delivery zones already exist')
  }

  // Sample menu items
  const itemCount = await db.request().query(`SELECT COUNT(*) AS cnt FROM menu_items WHERE tenant_id=${tenantId}`)
  if (itemCount.recordset[0].cnt === 0) {
    // Get category IDs
    const cats = await db.request().query(`SELECT id,name FROM categories WHERE tenant_id=${tenantId}`)
    const catMap = {}
    cats.recordset.forEach(c => { catMap[c.name] = c.id })

    const items = [
      { name: 'Five Stop Burger', cat: 'Burger', price: 1135, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80', featured: 1, bestSeller: 1, calories: 850 },
      { name: 'Margherita Pizza', cat: 'Pizza', price: 1300, image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&q=80', featured: 1, bestSeller: 1, calories: 680 },
      { name: 'Special Breakfast', cat: 'Breakfast', price: 957, image: 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=400&q=80', featured: 1, bestSeller: 1, calories: 780 },
      { name: 'Chicken Gyro', cat: 'Lunch', price: 1296, image: 'https://images.unsplash.com/photo-1512852939750-1305098529bf?w=400&q=80', featured: 0, bestSeller: 1, calories: 620 },
      { name: 'Spaghetti Bolognese', cat: 'Pasta', price: 980, image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&q=80', featured: 0, bestSeller: 0, calories: 720 },
      { name: 'Mango Juice', cat: 'Drinks', price: 130, image: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=400&q=80', featured: 0, bestSeller: 0, calories: 140 },
      { name: 'Espresso', cat: 'Coffee', price: 80, image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80', featured: 0, bestSeller: 0, calories: 5 },
      { name: 'Chocolate Cake', cat: 'Desserts', price: 450, image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80', featured: 0, bestSeller: 0, calories: 480 },
    ]

    let seeded = 0
    for (const item of items) {
      const catId = catMap[item.cat]
      if (!catId) continue
      const req = db.request()
      req.input('tid', sql.Int, tenantId)
      req.input('catId', sql.Int, catId)
      req.input('name', sql.NVarChar(200), item.name)
      req.input('price', sql.Float, item.price)
      req.input('img', sql.NVarChar(500), item.image)
      req.input('featured', sql.Bit, item.featured)
      req.input('bestSeller', sql.Bit, item.bestSeller)
      req.input('calories', sql.Int, item.calories)
      req.input('ref', sql.NVarChar(20), `A-${String(seeded + 1).padStart(3, '0')}`)
      await req.query(`
        INSERT INTO menu_items (tenant_id,category_id,name,price,image_url,is_available,is_featured,is_best_seller,rating,calories,menu_item_ref)
        VALUES (@tid,@catId,@name,@price,@img,1,@featured,@bestSeller,4.5,@calories,@ref)
      `)
      seeded++
    }
    console.log(`  ✅ ${seeded} sample menu items seeded`)
  } else {
    console.log('  ✓  Menu items already exist')
  }

  await db.close()

  // ── Done ───────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50))
  console.log('🎉 Setup complete! Your SQL Server database is ready.\n')
  console.log('  Database : digital_menu')
  console.log('  Server   : localhost\\SQLEXPRESS')
  console.log('\n  Default logins:')
  console.log('  ┌─────────────────────────────────────────┐')
  console.log('  │  Admin:      admin@abc.com / admin123   │')
  console.log('  │  Superadmin: superadmin@platform.com    │')
  console.log('  │              password: superadmin123    │')
  console.log('  └─────────────────────────────────────────┘')
  console.log('\n  Now start the backend:')
  console.log('  node server.js\n')
}

run().catch(err => {
  console.error('\n❌ Setup failed:', err.message)
  console.error('\nTroubleshooting:')
  console.error('  1. Make sure SQL Server Express is running')
  console.error('  2. Enable TCP/IP: SQL Server Configuration Manager')
  console.error('     → SQL Server Network Configuration')
  console.error('     → Protocols for SQLEXPRESS → TCP/IP → Enable')
  console.error('     → Restart SQL Server service')
  console.error('  3. If using SQL Auth, set MSSQL_USER and MSSQL_PASSWORD in .env')
  process.exit(1)
})
