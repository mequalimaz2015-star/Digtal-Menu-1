-- PostgreSQL schema for Digital Restaurant Menu
-- Run this once after creating your database on AletCloud

CREATE TABLE IF NOT EXISTS users (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(200) NOT NULL DEFAULT '',
    email      VARCHAR(200) UNIQUE NOT NULL,
    password   VARCHAR(200) NOT NULL,
    role       VARCHAR(50)  DEFAULT 'admin',
    is_active  BOOLEAN      DEFAULT TRUE,
    created_at TIMESTAMP    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restaurant (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(200) NOT NULL,
    name_am             VARCHAR(200),
    tagline             VARCHAR(300),
    description         TEXT,
    logo_url            VARCHAR(500),
    cover_url           VARCHAR(500),
    address             VARCHAR(500),
    phone               VARCHAR(50),
    wifi_password       VARCHAR(100),
    rating              FLOAT   DEFAULT 4.8,
    review_count        INT     DEFAULT 0,
    open_now            BOOLEAN DEFAULT TRUE,
    working_hours       VARCHAR(200),
    vat_rate            FLOAT   DEFAULT 0.15,
    service_charge_rate FLOAT   DEFAULT 0.10,
    currency            VARCHAR(10) DEFAULT 'ETB'
);

CREATE TABLE IF NOT EXISTS categories (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    name_am    VARCHAR(100),
    icon       VARCHAR(10),
    color      VARCHAR(20),
    sort_order INT     DEFAULT 0,
    is_active  BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_items (
    id               SERIAL PRIMARY KEY,
    category_id      INT REFERENCES categories(id),
    name             VARCHAR(200) NOT NULL,
    name_am          VARCHAR(200),
    description      TEXT,
    description_am   TEXT,
    price            FLOAT NOT NULL,
    image_url        VARCHAR(500),
    prep_time        INT     DEFAULT 15,
    is_spicy         BOOLEAN DEFAULT FALSE,
    is_vegetarian    BOOLEAN DEFAULT FALSE,
    is_available     BOOLEAN DEFAULT TRUE,
    is_featured      BOOLEAN DEFAULT FALSE,
    is_popular       BOOLEAN DEFAULT FALSE,
    is_best_seller   BOOLEAN DEFAULT FALSE,
    chef_recommended BOOLEAN DEFAULT FALSE,
    rating           FLOAT   DEFAULT 4.5,
    review_count     INT     DEFAULT 0,
    calories         INT,
    discount         FLOAT   DEFAULT 0,
    allergens        VARCHAR(500),
    created_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modifier_groups (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(200) NOT NULL,
    name_am      VARCHAR(200),
    required     BOOLEAN DEFAULT FALSE,
    multi_select BOOLEAN DEFAULT FALSE,
    max_select   INT     DEFAULT 1,
    created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modifiers (
    id           SERIAL PRIMARY KEY,
    group_id     INT REFERENCES modifier_groups(id) ON DELETE CASCADE,
    name         VARCHAR(200) NOT NULL,
    name_am      VARCHAR(200),
    price        FLOAT   DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS tables (
    id         SERIAL PRIMARY KEY,
    number     VARCHAR(20) UNIQUE NOT NULL,
    capacity   INT     DEFAULT 4,
    status     VARCHAR(20) DEFAULT 'available',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id               SERIAL PRIMARY KEY,
    order_ref        VARCHAR(50) UNIQUE NOT NULL,
    table_number     VARCHAR(20),
    customer_name    VARCHAR(200),
    phone            VARCHAR(50),
    notes            TEXT,
    status           VARCHAR(20) DEFAULT 'new',
    subtotal         FLOAT,
    vat              FLOAT,
    service_charge   FLOAT,
    grand_total      FLOAT,
    estimated_time   INT DEFAULT 20,
    order_type       VARCHAR(20) DEFAULT 'dine_in',
    pickup_number    VARCHAR(20),
    pickup_time      VARCHAR(50),
    delivery_address TEXT,
    delivery_lat     FLOAT,
    delivery_lng     FLOAT,
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id                   SERIAL PRIMARY KEY,
    order_id             INT REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_name       VARCHAR(200),
    price                FLOAT,
    quantity             INT,
    modifiers            TEXT,
    special_instructions TEXT,
    item_total           FLOAT
);

CREATE TABLE IF NOT EXISTS reviews (
    id             SERIAL PRIMARY KEY,
    order_ref      VARCHAR(50),
    table_number   VARCHAR(20),
    customer_name  VARCHAR(200),
    phone          VARCHAR(50),
    overall_rating INT,
    food_rating    INT,
    service_rating INT,
    comment        TEXT,
    created_at     TIMESTAMP DEFAULT NOW()
);

-- ── Seed Data ────────────────────────────────────────────────────────────────

-- Admin user (password = admin123)
INSERT INTO users (name, email, password, role)
VALUES ('Admin User', 'admin@abc.com',
        '$2a$10$zLByROZ8hW39Q874QZ/ZL.DFOX/6X3lmHhvE49G84vQxBfEW20XIS', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Restaurant info
INSERT INTO restaurant (name, name_am, tagline, address, phone, wifi_password, working_hours, cover_url)
SELECT 'ABC Restaurant', 'ኤቢሲ ምግብ ቤት', 'Fine Dining & Fast Delivery',
       'Bole Road, Addis Ababa, Ethiopia', '+251 91 859 2028',
       'ABCRest@2024', 'Mon–Sun: 7:00 AM – 11:00 PM',
       'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80'
WHERE NOT EXISTS (SELECT 1 FROM restaurant);

-- Categories
INSERT INTO categories (name, name_am, icon, color, sort_order) VALUES
    ('Breakfast', 'ቁርስ',    '🍳', '#f48c06', 0),
    ('Lunch',     'ምሳ',     '🥗', '#2d9d4f', 1),
    ('Dinner',    'እራት',   '🥩', '#8b1a1a', 2),
    ('Pizza',     'ፒዛ',     '🍕', '#e85d04', 3),
    ('Burger',    'በርገር',   '🍔', '#d4a017', 4),
    ('Pasta',     'ፓስታ',   '🍝', '#c0392b', 5),
    ('Drinks',    'መጠጦች', '🥤', '#2980b9', 6),
    ('Desserts',  'ጣፋጭ',  '🍰', '#e91e8c', 7),
    ('Coffee',    'ቡና',    '☕', '#6d4c41', 8)
ON CONFLICT DO NOTHING;

-- Tables
INSERT INTO tables (number, capacity) VALUES
    ('1', 2), ('2', 4), ('3', 4), ('4', 6),
    ('5', 2), ('6', 8), ('VIP 1', 4), ('Terrace 1', 6)
ON CONFLICT (number) DO NOTHING;
