const bcrypt = require('bcryptjs')

async function initMySqlSchema(pool) {
  const tables = [
    `CREATE TABLE IF NOT EXISTS subscription_plans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      price_etb DOUBLE NOT NULL DEFAULT 0,
      billing_interval VARCHAR(20) DEFAULT 'monthly',
      max_menu_items INT DEFAULT 30,
      max_tables INT DEFAULT 10,
      max_orders_per_month INT DEFAULT 500,
      max_staff_accounts INT DEFAULT 3,
      delivery_enabled BOOLEAN DEFAULT FALSE,
      white_label_enabled BOOLEAN DEFAULT FALSE,
      analytics_enabled BOOLEAN DEFAULT TRUE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS tenants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      name_am VARCHAR(200),
      slug VARCHAR(100) UNIQUE NOT NULL,
      tagline VARCHAR(300),
      description TEXT,
      logo_url VARCHAR(500),
      cover_url VARCHAR(500),
      address VARCHAR(500),
      phone VARCHAR(50),
      email VARCHAR(200),
      wifi_password VARCHAR(100),
      working_hours VARCHAR(200),
      vat_rate DOUBLE DEFAULT 0.15,
      service_charge_rate DOUBLE DEFAULT 0.10,
      currency VARCHAR(10) DEFAULT 'ETB',
      status VARCHAR(30) DEFAULT 'active',
      subscription_plan_id INT,
      subscription_status VARCHAR(30) DEFAULT 'active',
      trial_ends_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS subscriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      plan_id INT NOT NULL,
      status VARCHAR(30) DEFAULT 'active',
      current_period_start DATETIME DEFAULT CURRENT_TIMESTAMP,
      current_period_end DATETIME,
      payment_provider VARCHAR(50) DEFAULT 'chapa',
      payment_reference VARCHAR(200),
      amount_paid DOUBLE DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NULL,
      name VARCHAR(200) NOT NULL DEFAULT '',
      email VARCHAR(200) UNIQUE NOT NULL,
      password VARCHAR(200) NOT NULL,
      role VARCHAR(50) DEFAULT 'admin',
      phone VARCHAR(50),
      is_active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS restaurant (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      name_am VARCHAR(200),
      tagline VARCHAR(300),
      description TEXT,
      logo_url VARCHAR(500),
      cover_url VARCHAR(500),
      address VARCHAR(500),
      phone VARCHAR(50),
      wifi_password VARCHAR(100),
      rating DOUBLE DEFAULT 4.8,
      review_count INT DEFAULT 0,
      open_now BOOLEAN DEFAULT TRUE,
      working_hours VARCHAR(200),
      vat_rate DOUBLE DEFAULT 0.15,
      service_charge_rate DOUBLE DEFAULT 0.10,
      currency VARCHAR(10) DEFAULT 'ETB'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NULL,
      name VARCHAR(100) NOT NULL,
      name_am VARCHAR(100),
      icon VARCHAR(20),
      color VARCHAR(30),
      sort_order INT DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS menu_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NULL,
      category_id INT NULL,
      name VARCHAR(200) NOT NULL,
      name_am VARCHAR(200),
      description TEXT,
      description_am TEXT,
      price DOUBLE NOT NULL,
      image_url VARCHAR(500),
      prep_time INT DEFAULT 15,
      is_spicy BOOLEAN DEFAULT FALSE,
      is_vegetarian BOOLEAN DEFAULT FALSE,
      is_available BOOLEAN DEFAULT TRUE,
      is_featured BOOLEAN DEFAULT FALSE,
      is_popular BOOLEAN DEFAULT FALSE,
      is_best_seller BOOLEAN DEFAULT FALSE,
      chef_recommended BOOLEAN DEFAULT FALSE,
      rating DOUBLE DEFAULT 4.5,
      review_count INT DEFAULT 0,
      calories INT,
      discount DOUBLE DEFAULT 0,
      allergens VARCHAR(500),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS modifier_groups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NULL,
      name VARCHAR(200) NOT NULL,
      name_am VARCHAR(200),
      required BOOLEAN DEFAULT FALSE,
      multi_select BOOLEAN DEFAULT FALSE,
      max_select INT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS modifiers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      group_id INT NOT NULL,
      name VARCHAR(200) NOT NULL,
      name_am VARCHAR(200),
      price DOUBLE DEFAULT 0,
      is_available BOOLEAN DEFAULT TRUE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS tables (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NULL,
      number VARCHAR(20) NOT NULL,
      capacity INT DEFAULT 4,
      status VARCHAR(20) DEFAULT 'available',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS delivery_zones (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      zone_name VARCHAR(100) NOT NULL,
      min_order_amount DOUBLE DEFAULT 0,
      delivery_fee DOUBLE DEFAULT 0,
      estimated_delivery_minutes INT DEFAULT 45,
      is_active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS customer_addresses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      label VARCHAR(100) DEFAULT 'Home',
      address_text TEXT NOT NULL,
      city VARCHAR(100) DEFAULT 'Addis Ababa',
      subcity VARCHAR(100),
      woreda VARCHAR(50),
      building VARCHAR(100),
      floor_door VARCHAR(50),
      lat DOUBLE,
      lng DOUBLE,
      phone VARCHAR(50),
      is_default BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NULL,
      user_id INT NULL,
      order_ref VARCHAR(50) UNIQUE NOT NULL,
      table_number VARCHAR(20),
      customer_name VARCHAR(200),
      phone VARCHAR(50),
      notes TEXT,
      status VARCHAR(20) DEFAULT 'new',
      subtotal DOUBLE,
      vat DOUBLE,
      service_charge DOUBLE,
      grand_total DOUBLE,
      estimated_time INT DEFAULT 20,
      order_type VARCHAR(20) DEFAULT 'dine_in',
      pickup_number VARCHAR(20),
      pickup_time VARCHAR(50),
      delivery_address TEXT,
      delivery_lat DOUBLE,
      delivery_lng DOUBLE,
      delivery_zone_id INT NULL,
      rider_id INT NULL,
      delivery_fee DOUBLE DEFAULT 0,
      delivery_status VARCHAR(50) DEFAULT 'pending',
      payment_method VARCHAR(50) DEFAULT 'cash',
      payment_status VARCHAR(50) DEFAULT 'pending',
      payment_tx_ref VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NULL,
      menu_item_name VARCHAR(200),
      price DOUBLE,
      quantity INT,
      modifiers TEXT,
      special_instructions TEXT,
      item_total DOUBLE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NULL,
      order_ref VARCHAR(50),
      table_number VARCHAR(20),
      customer_name VARCHAR(200),
      phone VARCHAR(50),
      overall_rating INT,
      food_rating INT,
      service_rating INT,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS waiter_calls (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NULL,
      table_number VARCHAR(20) NOT NULL,
      type VARCHAR(50) DEFAULT 'service',
      status VARCHAR(20) DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS chat_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NULL,
      session_id VARCHAR(100) NOT NULL,
      sender VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      tenant_id INT NULL,
      action VARCHAR(100) NOT NULL,
      details TEXT,
      ip_address VARCHAR(50),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS announcements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      priority VARCHAR(20) DEFAULT 'normal',
      is_active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS platform_settings (
      setting_key VARCHAR(100) PRIMARY KEY,
      setting_value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  ]

  for (const sql of tables) {
    try {
      await pool.query(sql)
    } catch (e) {
      console.warn('Notice creating MySQL table:', e.message)
    }
  }
}

async function seedMySqlDefaults(pool) {
  try {
    // 1. Seed plans
    const [plans] = await pool.query('SELECT COUNT(*) as count FROM subscription_plans')
    if (plans[0]?.count === 0) {
      await pool.query(`
        INSERT INTO subscription_plans (id, name, description, price_etb, billing_interval, max_menu_items, max_tables, max_orders_per_month, max_staff_accounts, delivery_enabled, white_label_enabled, analytics_enabled)
        VALUES 
          (1, 'Free Trial', '14-day free trial with standard digital menu features', 0, 'monthly', 20, 5, 200, 2, FALSE, FALSE, TRUE),
          (2, 'Basic Plan', 'Essential digital menu and QR ordering for small cafes & restaurants', 1500, 'monthly', 50, 15, 1000, 5, FALSE, FALSE, TRUE),
          (3, 'Pro SaaS + Delivery', 'Complete digital restaurant suite with online delivery, riders, and unlimited menu items', 3500, 'monthly', 9999, 50, 10000, 20, TRUE, TRUE, TRUE)
      `)
    }

    // 2. Seed default tenant (ABC Restaurant)
    const [tenants] = await pool.query('SELECT COUNT(*) as count FROM tenants WHERE id = 1 OR slug = "abc-restaurant"')
    if (tenants[0]?.count === 0) {
      await pool.query(`
        INSERT INTO tenants (id, name, name_am, slug, tagline, address, phone, wifi_password, working_hours, cover_url, status, subscription_plan_id, subscription_status)
        VALUES (
          1, 
          'ABC Restaurant', 
          'ኤቢሲ ምግብ ቤት', 
          'abc-restaurant', 
          'Fine Dining & Fast Delivery', 
          'Bole Road, Addis Ababa, Ethiopia', 
          '+251 91 859 2028', 
          'ABCRest@2024', 
          'Mon–Sun: 7:00 AM – 11:00 PM', 
          'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80', 
          'active', 
          3, 
          'active'
        )
      `)
    }

    // 3. Seed Super Admin User (superadmin@platform.com / superadmin123)
    const [superAdminUser] = await pool.query('SELECT id FROM users WHERE LOWER(email) = "superadmin@platform.com"')
    const superAdminHash = bcrypt.hashSync('superadmin123', 10)
    if (superAdminUser.length === 0) {
      await pool.query(
        `INSERT INTO users (name, email, password, role, is_active, tenant_id)
         VALUES (?, ?, ?, 'super_admin', 1, NULL)`,
        ['Super Platform Owner', 'superadmin@platform.com', superAdminHash]
      )
    } else {
      await pool.query(
        `UPDATE users SET password = ?, role = 'super_admin', is_active = 1 WHERE id = ?`,
        [superAdminHash, superAdminUser[0].id]
      )
    }

    // 4. Seed Restaurant Admin User (admin@abc.com / admin123)
    const [adminUser] = await pool.query('SELECT id FROM users WHERE LOWER(email) = "admin@abc.com"')
    const adminHash = bcrypt.hashSync('admin123', 10)
    if (adminUser.length === 0) {
      await pool.query(
        `INSERT INTO users (name, email, password, role, is_active, tenant_id)
         VALUES (?, ?, ?, 'admin', 1, 1)`,
        ['Admin User', 'admin@abc.com', adminHash]
      )
    }

    // 5. Seed Rider User (rider@abc.com / admin123)
    const [riderUser] = await pool.query('SELECT id FROM users WHERE LOWER(email) = "rider@abc.com"')
    if (riderUser.length === 0) {
      await pool.query(
        `INSERT INTO users (name, email, password, role, is_active, tenant_id)
         VALUES (?, ?, ?, 'rider', 1, 1)`,
        ['Rider User', 'rider@abc.com', adminHash]
      )
    }

    // 6. Seed Categories for tenant 1
    const [categories] = await pool.query('SELECT COUNT(*) as count FROM categories WHERE tenant_id = 1')
    if (categories[0]?.count === 0) {
      await pool.query(`
        INSERT INTO categories (tenant_id, name, name_am, icon, color, sort_order) VALUES
          (1, 'Breakfast', 'ቁርስ', '🍳', '#f48c06', 0),
          (1, 'Lunch', 'ምሳ', '🥗', '#2d9d4f', 1),
          (1, 'Dinner', 'እራት', '🥩', '#8b1a1a', 2),
          (1, 'Pizza', 'ፒዛ', '🍕', '#e85d04', 3),
          (1, 'Burger', 'በርገር', '🍔', '#d4a017', 4),
          (1, 'Pasta', 'ፓስታ', '🍝', '#c0392b', 5),
          (1, 'Drinks', 'መጠጦች', '🥤', '#2980b9', 6),
          (1, 'Desserts', 'ጣፋጭ', '🍰', '#e91e8c', 7),
          (1, 'Coffee', 'ቡና', '☕', '#6d4c41', 8)
      `)
    }

    // 7. Seed Tables for tenant 1
    const [tables] = await pool.query('SELECT COUNT(*) as count FROM tables WHERE tenant_id = 1')
    if (tables[0]?.count === 0) {
      await pool.query(`
        INSERT INTO tables (tenant_id, number, capacity) VALUES
          (1, '1', 2), (1, '2', 4), (1, '3', 4), (1, '4', 6),
          (1, '5', 2), (1, '6', 8), (1, 'VIP 1', 4), (1, 'Terrace 1', 6)
      `)
    }

    // 8. Seed Delivery Zones for tenant 1
    const [deliveryZones] = await pool.query('SELECT COUNT(*) as count FROM delivery_zones WHERE tenant_id = 1')
    if (deliveryZones[0]?.count === 0) {
      await pool.query(`
        INSERT INTO delivery_zones (tenant_id, zone_name, min_order_amount, delivery_fee, estimated_delivery_minutes) VALUES
          (1, 'Bole & Around', 200, 100, 30),
          (1, 'Kazanchis & Kirkos', 300, 150, 45),
          (1, 'Piassa & Arada', 400, 200, 50)
      `)
    }

    // 9. Seed Menu Items for tenant 1 if empty
    const [menuItems] = await pool.query('SELECT COUNT(*) as count FROM menu_items WHERE tenant_id = 1')
    if (menuItems[0]?.count === 0) {
      const [catRows] = await pool.query('SELECT id, name FROM categories WHERE tenant_id = 1')
      const catMap = {}
      for (const c of catRows) catMap[c.name] = c.id

      await pool.query(`
        INSERT INTO menu_items (tenant_id, category_id, name, name_am, description, price, image_url, prep_time, is_available, is_featured, is_popular, is_best_seller, chef_recommended, rating, review_count, calories) VALUES
          (1, ?, 'Five Stop Burger', 'ፋይቭ ስቶፕ በርገር', 'Double beef patty, special sauce, melted cheese.', 1135, 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&q=80', 15, 1, 1, 1, 1, 1, 4.9, 421, 850),
          (1, ?, 'Margherita Pizza', 'ማርጌሪታ ፒዛ', 'Classic tomato, mozzarella, fresh basil.', 1300, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&q=80', 18, 1, 1, 1, 1, 0, 4.8, 156, 680),
          (1, ?, 'Special Breakfast', 'ልዩ ቁርስ', 'Full breakfast platter with eggs, fresh bread, and beans.', 957, 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=400&q=80', 15, 1, 1, 1, 1, 1, 4.9, 112, 780),
          (1, ?, 'Chicken Gyro', 'ዶሮ ጂሮ', 'Marinated grilled chicken with tzatziki in warm pita.', 1296, 'https://images.unsplash.com/photo-1512852939750-1305098529bf?w=400&q=80', 14, 1, 1, 1, 1, 0, 4.8, 178, 620),
          (1, ?, 'Soft Drink', 'ለስላሳ', 'Chilled Coke, Sprite, or Fanta.', 130, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80', 2, 1, 0, 1, 0, 0, 4.4, 178, 140)
      `, [
        catMap['Burger'] || null,
        catMap['Pizza'] || null,
        catMap['Breakfast'] || null,
        catMap['Lunch'] || null,
        catMap['Drinks'] || null
      ])
    }
  } catch (seedErr) {
    console.warn('Notice seeding MySQL defaults:', seedErr.message)
  }
}

module.exports = {
  initMySqlSchema,
  seedMySqlDefaults
}
