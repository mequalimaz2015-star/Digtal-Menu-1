/**
 * schema-sqlserver.js
 * Auto-creates all tables and seeds default data for SQL Server (local dev).
 * Called once on first boot when DB_CONNECTION=sqlserver.
 */
const bcrypt = require('bcryptjs')
async function initSqlServerSchema(pool) {
  const tables = [
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
    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tenants' AND xtype='U')
    CREATE TABLE tenants (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(200) NOT NULL,
      name_am NVARCHAR(200),
      slug NVARCHAR(100) UNIQUE NOT NULL,
      tagline NVARCHAR(300),
      description NVARCHAR(MAX),
      logo_url NVARCHAR(500),
      cover_url NVARCHAR(500),
      logo_url NVARCHAR(MAX),
      cover_url NVARCHAR(MAX),
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

    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
    CREATE TABLE users (
      id INT IDENTITY(1,1) PRIMARY KEY,
      tenant_id INT NULL,
      name NVARCHAR(200) NOT NULL DEFAULT '',
      email NVARCHAR(200) UNIQUE NOT NULL,
      password NVARCHAR(200) NOT NULL,
      role NVARCHAR(50) DEFAULT 'admin',
      phone NVARCHAR(50),
      is_active BIT DEFAULT 1,
      created_at DATETIME DEFAULT GETDATE()
    )`,

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

    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tables' AND xtype='U')
    CREATE TABLE tables (
      id INT IDENTITY(1,1) PRIMARY KEY,
      tenant_id INT NULL,
      number NVARCHAR(20) NOT NULL,
      capacity INT DEFAULT 4,
      status NVARCHAR(20) DEFAULT 'available',
      created_at DATETIME DEFAULT GETDATE()
    )`,

    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='orders' AND xtype='U')
    CREATE TABLE orders (
      id INT IDENTITY(1,1) PRIMARY KEY,
      tenant_id INT NULL,
      user_id INT NULL,
      order_ref NVARCHAR(50) UNIQUE NOT NULL,
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
      delivery_fee FLOAT DEFAULT 0,
      delivery_status NVARCHAR(50) DEFAULT 'pending',
      payment_method NVARCHAR(50) DEFAULT 'cash',
      payment_status NVARCHAR(50) DEFAULT 'pending',
      session_id NVARCHAR(100) NULL,
      created_at DATETIME DEFAULT GETDATE(),
      updated_at DATETIME DEFAULT GETDATE()
    )`,

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

    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='modifiers' AND xtype='U')
    CREATE TABLE modifiers (
      id INT IDENTITY(1,1) PRIMARY KEY,
      group_id INT NOT NULL,
      name NVARCHAR(200) NOT NULL,
      name_am NVARCHAR(200),
      price FLOAT DEFAULT 0,
      is_available BIT DEFAULT 1
    )`,

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

    `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='announcements' AND xtype='U')
    CREATE TABLE announcements (
      id INT IDENTITY(1,1) PRIMARY KEY,
      title NVARCHAR(255) NOT NULL,
      content NVARCHAR(MAX) NOT NULL,
      priority NVARCHAR(20) DEFAULT 'normal',
      is_active BIT DEFAULT 1,
      created_at DATETIME DEFAULT GETDATE()
    )`,
  ]

  for (const sql of tables) {
    try {
      await pool.request().query(sql)
    } catch (e) {
      console.warn('Notice creating SQL Server table:', e.message)
    }
  }
}

async function seedSqlServerDefaults(pool) {
  try {
    // 0. Live column migrations — add any new columns that may not exist yet
    const columnMigrations = [
      { table: 'tenants', column: 'tin_number', definition: 'NVARCHAR(20) NULL' },
    ]
    // Also ensure logo_url and cover_url are NVARCHAR(MAX) (not the old NVARCHAR(500))
    try {
      await pool.request().query(`
        IF EXISTS (
          SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME='tenants' AND COLUMN_NAME='logo_url'
          AND CHARACTER_MAXIMUM_LENGTH IS NOT NULL AND CHARACTER_MAXIMUM_LENGTH < 2000
        )
        ALTER TABLE tenants ALTER COLUMN logo_url NVARCHAR(MAX)
      `)
      await pool.request().query(`
        IF EXISTS (
          SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME='tenants' AND COLUMN_NAME='cover_url'
          AND CHARACTER_MAXIMUM_LENGTH IS NOT NULL AND CHARACTER_MAXIMUM_LENGTH < 2000
        )
        ALTER TABLE tenants ALTER COLUMN cover_url NVARCHAR(MAX)
      `)
    } catch (_) {}
    for (const { table, column, definition } of columnMigrations) {
      try {
        const checkCol = await pool.request().query(
          `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_NAME='${table}' AND COLUMN_NAME='${column}'`
        )
        if (checkCol.recordset[0].cnt === 0) {
          await pool.request().query(`ALTER TABLE ${table} ADD ${column} ${definition}`)
          console.log(`✅ SQL Server migration: added ${table}.${column}`)
        }
      } catch (colErr) {
        console.warn(`Notice: SQL Server column migration (${table}.${column}):`, colErr.message)
      }
    }
    // 1. Subscription plans
    const plansRes = await pool.request().query('SELECT COUNT(*) AS cnt FROM subscription_plans')
    if (plansRes.recordset[0].cnt === 0) {
      await pool.request().query(`
        INSERT INTO subscription_plans (name,description,price_etb,billing_interval,max_menu_items,max_tables,max_orders_per_month,max_staff_accounts,delivery_enabled,white_label_enabled,analytics_enabled)
        VALUES
          ('Free Trial','14-day free trial',0,'monthly',20,5,200,2,0,0,1),
          ('Basic Plan','Essential digital menu',1500,'monthly',50,15,1000,5,0,0,1),
          ('Pro SaaS + Delivery','Complete suite with delivery',3500,'monthly',9999,50,10000,20,1,1,1)
      `)
    }

    // 2. Default tenant
    const tenantRes = await pool.request().query("SELECT COUNT(*) AS cnt FROM tenants WHERE id=1 OR slug='abc-restaurant'")
    if (tenantRes.recordset[0].cnt === 0) {
      await pool.request().query(`
        INSERT INTO tenants (name,name_am,slug,tagline,address,phone,wifi_password,working_hours,status,subscription_plan_id,subscription_status)
        VALUES (
          'ABC Restaurant','ኤቢሲ ምግብ ቤት','abc-restaurant',
          'Fine Dining & Fast Delivery','Bole Road, Addis Ababa',
          '+251 91 859 2028','ABCRest@2024','Mon–Sun: 7:00 AM – 11:00 PM',
          'active',3,'active'
        )
      `)
    }

    // 3. Super admin user
    const saRes = await pool.request().query("SELECT id FROM users WHERE email='superadmin@platform.com'")
    const saHash = bcrypt.hashSync('superadmin123', 10)
    if (saRes.recordset.length === 0) {
      const req = pool.request()
      req.input('hash', saHash)
      await req.query("INSERT INTO users (name,email,password,role,is_active) VALUES ('Super Platform Owner','superadmin@platform.com',@hash,'super_admin',1)")
    }

    // 4. Restaurant admin
    const adminRes = await pool.request().query("SELECT id FROM users WHERE email='admin@abc.com'")
    const adminHash = bcrypt.hashSync('admin123', 10)
    if (adminRes.recordset.length === 0) {
      const req = pool.request()
      req.input('hash', adminHash)
      await req.query("INSERT INTO users (name,email,password,role,is_active,tenant_id) VALUES ('Admin User','admin@abc.com',@hash,'admin',1,1)")
    }

    // 5. Seed categories for tenant 1
    const catRes = await pool.request().query('SELECT COUNT(*) AS cnt FROM categories WHERE tenant_id=1')
    if (catRes.recordset[0].cnt === 0) {
      await pool.request().query(`
        INSERT INTO categories (tenant_id,name,name_am,icon,color,sort_order) VALUES
          (1,'Breakfast','ቁርስ','🍳','#f48c06',0),
          (1,'Lunch','ምሳ','🥗','#2d9d4f',1),
          (1,'Dinner','እራት','🥩','#8b1a1a',2),
          (1,'Drinks','መጠጦች','🥤','#2980b9',3),
          (1,'Desserts','ጣፋጭ','🍰','#e91e8c',4)
      `)
    }

    // 6. Seed tables for tenant 1
    const tableRes = await pool.request().query('SELECT COUNT(*) AS cnt FROM tables WHERE tenant_id=1')
    if (tableRes.recordset[0].cnt === 0) {
      await pool.request().query(`
        INSERT INTO tables (tenant_id,number,capacity) VALUES
          (1,'1',2),(1,'2',4),(1,'3',4),(1,'4',6),(1,'5',2),(1,'6',8)
      `)
    }

  } catch (seedErr) {
    console.warn('Notice seeding SQL Server defaults:', seedErr.message)
  }
}

module.exports = { initSqlServerSchema, seedSqlServerDefaults }
