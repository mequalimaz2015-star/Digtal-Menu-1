-- Multi-Tenant SaaS Schema Migration for PostgreSQL
-- Converts single-restaurant schema into multi-tenant SaaS with Subscriptions & Delivery

-- 1. Create Subscription Plans Table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id                 SERIAL PRIMARY KEY,
    name               VARCHAR(100) NOT NULL,
    description        TEXT,
    price_etb          FLOAT NOT NULL DEFAULT 0,
    billing_interval   VARCHAR(20) DEFAULT 'monthly', -- 'monthly' or 'yearly'
    max_menu_items     INT DEFAULT 30,
    max_tables         INT DEFAULT 10,
    max_orders_per_month INT DEFAULT 500,
    max_staff_accounts INT DEFAULT 3,
    delivery_enabled   BOOLEAN DEFAULT FALSE,
    white_label_enabled BOOLEAN DEFAULT FALSE,
    analytics_enabled  BOOLEAN DEFAULT TRUE,
    is_active          BOOLEAN DEFAULT TRUE,
    created_at         TIMESTAMP DEFAULT NOW()
);

-- 2. Create Tenants (Restaurants) Table
CREATE TABLE IF NOT EXISTS tenants (
    id                   SERIAL PRIMARY KEY,
    name                 VARCHAR(200) NOT NULL,
    name_am              VARCHAR(200),
    slug                 VARCHAR(100) UNIQUE NOT NULL,
    tagline              VARCHAR(300),
    description          TEXT,
    logo_url             VARCHAR(500),
    cover_url            VARCHAR(500),
    address              VARCHAR(500),
    phone                VARCHAR(50),
    email                VARCHAR(200),
    wifi_password        VARCHAR(100),
    working_hours        VARCHAR(200),
    vat_rate             FLOAT DEFAULT 0.15,
    service_charge_rate  FLOAT DEFAULT 0.10,
    currency             VARCHAR(10) DEFAULT 'ETB',
    status               VARCHAR(30) DEFAULT 'active', -- 'trial', 'active', 'suspended', 'cancelled'
    subscription_plan_id INT REFERENCES subscription_plans(id),
    subscription_status  VARCHAR(30) DEFAULT 'active', -- 'trialing', 'active', 'past_due', 'cancelled'
    trial_ends_at        TIMESTAMP,
    created_at           TIMESTAMP DEFAULT NOW(),
    updated_at           TIMESTAMP DEFAULT NOW()
);

-- 3. Subscriptions History / Tracking
CREATE TABLE IF NOT EXISTS subscriptions (
    id                   SERIAL PRIMARY KEY,
    tenant_id            INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id              INT NOT NULL REFERENCES subscription_plans(id),
    status               VARCHAR(30) DEFAULT 'active',
    current_period_start TIMESTAMP DEFAULT NOW(),
    current_period_end   TIMESTAMP,
    payment_provider     VARCHAR(50) DEFAULT 'chapa', -- 'chapa', 'telebirr', 'cash', 'manual'
    payment_reference    VARCHAR(200),
    amount_paid          FLOAT DEFAULT 0,
    created_at           TIMESTAMP DEFAULT NOW()
);

-- 4. Customer Addresses Table for Delivery
CREATE TABLE IF NOT EXISTS customer_addresses (
    id            SERIAL PRIMARY KEY,
    user_id       INT REFERENCES users(id) ON DELETE CASCADE,
    label         VARCHAR(100) DEFAULT 'Home',
    address_text  TEXT NOT NULL,
    city          VARCHAR(100) DEFAULT 'Addis Ababa',
    subcity       VARCHAR(100),
    woreda        VARCHAR(50),
    building      VARCHAR(100),
    floor_door    VARCHAR(50),
    lat           FLOAT,
    lng           FLOAT,
    phone         VARCHAR(50),
    is_default    BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMP DEFAULT NOW()
);

-- 5. Delivery Zones Table
CREATE TABLE IF NOT EXISTS delivery_zones (
    id                         SERIAL PRIMARY KEY,
    tenant_id                  INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    zone_name                  VARCHAR(100) NOT NULL,
    min_order_amount           FLOAT DEFAULT 0,
    delivery_fee               FLOAT DEFAULT 0,
    estimated_delivery_minutes INT DEFAULT 45,
    is_active                  BOOLEAN DEFAULT TRUE,
    created_at                 TIMESTAMP DEFAULT NOW()
);

-- 6. Platform Audit Logs (e.g., Super Admin Impersonation, Plan updates)
CREATE TABLE IF NOT EXISTS audit_logs (
    id               SERIAL PRIMARY KEY,
    user_id          INT REFERENCES users(id) ON DELETE SET NULL,
    tenant_id        INT REFERENCES tenants(id) ON DELETE SET NULL,
    action           VARCHAR(100) NOT NULL,
    details          TEXT,
    ip_address       VARCHAR(50),
    created_at       TIMESTAMP DEFAULT NOW()
);

-- 7. Add tenant_id & delivery fields to existing tables

-- USERS TABLE
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
-- Modify role constraint support for 'super_admin', 'admin', 'kitchen', 'waiter', 'rider', 'customer'

-- CATEGORIES TABLE
ALTER TABLE categories ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE;

-- MENU ITEMS TABLE
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE;

-- MODIFIER GROUPS TABLE
ALTER TABLE modifier_groups ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE;

-- TABLES TABLE
ALTER TABLE tables ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE;
-- Remove old global UNIQUE constraint on table number if present, drop constraint if exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tables_number_key') THEN
        ALTER TABLE tables DROP CONSTRAINT tables_number_key;
    END IF;
END $$;

-- ORDERS TABLE
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_zone_id INT REFERENCES delivery_zones(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_id INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee FLOAT DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(50) DEFAULT 'pending'; -- 'pending', 'assigned', 'picked_up', 'on_the_way', 'delivered', 'failed'
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash'; -- 'cash', 'chapa', 'telebirr'
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending'; -- 'pending', 'paid', 'failed'
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_tx_ref VARCHAR(100);

-- REVIEWS TABLE
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE;

-- WAITER CALLS (if present)
CREATE TABLE IF NOT EXISTS waiter_calls (
    id           SERIAL PRIMARY KEY,
    tenant_id    INT REFERENCES tenants(id) ON DELETE CASCADE,
    table_number VARCHAR(20) NOT NULL,
    type         VARCHAR(50) DEFAULT 'service',
    status       VARCHAR(20) DEFAULT 'pending',
    created_at   TIMESTAMP DEFAULT NOW(),
    resolved_at  TIMESTAMP
);

-- CHAT MESSAGES / SESSIONS
CREATE TABLE IF NOT EXISTS chat_messages (
    id           SERIAL PRIMARY KEY,
    tenant_id    INT REFERENCES tenants(id) ON DELETE CASCADE,
    session_id   VARCHAR(100) NOT NULL,
    sender       VARCHAR(50) NOT NULL, -- 'customer', 'staff'
    message      TEXT NOT NULL,
    is_read      BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMP DEFAULT NOW()
);

-- 8. Seed Default Subscription Plans
INSERT INTO subscription_plans (id, name, description, price_etb, billing_interval, max_menu_items, max_tables, max_orders_per_month, max_staff_accounts, delivery_enabled, white_label_enabled, analytics_enabled)
VALUES 
    (1, 'Free Trial', '14-day free trial with standard digital menu features', 0, 'monthly', 20, 5, 200, 2, FALSE, FALSE, TRUE),
    (2, 'Basic Plan', 'Essential digital menu and QR ordering for small cafes & restaurants', 1500, 'monthly', 50, 15, 1000, 5, FALSE, FALSE, TRUE),
    (3, 'Pro SaaS + Delivery', 'Complete digital restaurant suite with online delivery, riders, and unlimited menu items', 3500, 'monthly', 9999, 50, 10000, 20, TRUE, TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    price_etb = EXCLUDED.price_etb,
    max_menu_items = EXCLUDED.max_menu_items,
    delivery_enabled = EXCLUDED.delivery_enabled;

-- 9. Seed Default Tenant #1 (ABC Restaurant)
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
) ON CONFLICT (id) DO UPDATE SET slug = 'abc-restaurant';

-- 10. Seed Super Admin User (email: superadmin@platform.com, pass: superadmin123)
-- Hash generated using bcrypt for 'superadmin123'
INSERT INTO users (name, email, password, role, tenant_id)
VALUES (
    'Super Platform Owner', 
    'superadmin@platform.com', 
    '$2a$10$zLByROZ8hW39Q874QZ/ZL.DFOX/6X3lmHhvE49G84vQxBfEW20XIS', 
    'super_admin', 
    NULL
) ON CONFLICT (email) DO NOTHING;

-- 11. Migrate Existing Unassigned Data to Tenant #1
UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL AND role != 'super_admin';
UPDATE categories SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE menu_items SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE modifier_groups SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE tables SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE orders SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE reviews SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE waiter_calls SET tenant_id = 1 WHERE tenant_id IS NULL;
UPDATE chat_messages SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 12. Seed Delivery Zones for Tenant #1
INSERT INTO delivery_zones (tenant_id, zone_name, min_order_amount, delivery_fee, estimated_delivery_minutes)
VALUES 
    (1, 'Bole & Around', 200, 100, 30),
    (1, 'Kazanchis & Kirkos', 300, 150, 45),
    (1, 'Piassa & Arada', 400, 200, 50)
ON CONFLICT DO NOTHING;
