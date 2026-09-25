/**
 * localStore.js
 * Comprehensive fallback store when PostgreSQL database connection is unavailable.
 * Persists tenants, users, plans, delivery zones, orders, categories, menu items,
 * modifiers, and tables to data.json.
 */
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, 'data.json')

const DEFAULT_PLANS = [
  { id: 1, name: 'Free Trial', price_etb: 0, max_menu_items: 20, max_tables: 5, max_staff_accounts: 2, delivery_enabled: false, description: '14-day free trial' },
  { id: 2, name: 'Basic Plan', price_etb: 1500, max_menu_items: 50, max_tables: 15, max_staff_accounts: 5, delivery_enabled: false, description: 'Essential digital menu' },
  { id: 3, name: 'Pro SaaS + Delivery', price_etb: 3500, max_menu_items: 9999, max_tables: 50, max_staff_accounts: 20, delivery_enabled: true, description: 'Complete restaurant suite' }
]

const DEFAULT_TENANT = {
  id: 1,
  name: 'ABC Restaurant',
  name_am: 'ኤቢሲ ምግብ ቤት',
  slug: 'abc-restaurant',
  tagline: 'Fine Dining & Fast Delivery',
  description: 'Welcome to ABC Restaurant — fresh flavors & exceptional service.',
  logo_url: '',
  cover_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80',
  address: 'Bole Road, Addis Ababa, Ethiopia',
  phone: '+251 91 859 2028',
  wifi_password: 'ABCRest@2024',
  working_hours: 'Mon–Sun: 7:00 AM – 11:00 PM',
  status: 'active',
  subscription_plan_id: 3,
  subscription_status: 'active',
  vat_rate: 0.15,
  service_charge_rate: 0.10,
  currency: 'ETB',
  delivery_enabled: true
}

const DEFAULT_USERS = [
  { id: 1, name: 'Admin User', email: 'admin@abc.com', role: 'admin', tenant_id: 1, is_active: true },
  { id: 2, name: 'Super Platform Owner', email: 'superadmin@platform.com', role: 'super_admin', tenant_id: null, is_active: true }
]

// ── Default Seed Data for Five Stop Restaurant (Tenant 1) ──────────────────────
const FIVE_STOP_CATEGORIES = [
  { id: 1, tenant_id: 1, name: 'Breakfast',   name_am: 'ቁርስ',     icon: '🍳', color: '#f48c06', sort_order: 0, is_active: true },
  { id: 2, tenant_id: 1, name: 'Pizza',        name_am: 'ፒዛ',      icon: '🍕', color: '#e63946', sort_order: 1, is_active: true },
  { id: 3, tenant_id: 1, name: 'Burgers',      name_am: 'በርገር',    icon: '🍔', color: '#d4a017', sort_order: 2, is_active: true },
  { id: 4, tenant_id: 1, name: 'Gyros',        name_am: 'ጂሮ',      icon: '🥙', color: '#2d9d4f', sort_order: 3, is_active: true },
  { id: 5, tenant_id: 1, name: 'Wings',        name_am: 'ክንፎች',    icon: '🍗', color: '#c1121f', sort_order: 4, is_active: true },
  { id: 6, tenant_id: 1, name: 'Sides & More', name_am: 'ተጨማሪ',   icon: '🍟', color: '#8338ec', sort_order: 5, is_active: true },
  { id: 7, tenant_id: 1, name: 'Beverages',    name_am: 'መጠጦች',   icon: '🥤', color: '#2980b9', sort_order: 6, is_active: true },
]

const FIVE_STOP_MENU_ITEMS = [
  { id:1,  tenant_id:1, category_id:1, name:'Cookies / Brownies',     name_am:'ኩኪዝ / ብራውኒ',       description:'Freshly baked cookies and brownies.',  price:478,  image_url:'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80',  prep_time:5,  is_spicy:false, is_vegetarian:true,  is_available:true, is_featured:false, is_popular:true,  is_best_seller:false, chef_recommended:false, rating:4.7, review_count:45,  calories:320, discount:0 },
  { id:2,  tenant_id:1, category_id:1, name:'Manyeesh / Zaatar',       name_am:'ማንዬሽ / ዛዓታር',     description:'Traditional Lebanese flatbread.',       price:522,  image_url:'https://images.unsplash.com/photo-1571197119738-04a0b7ded40f?w=400&q=80',  prep_time:10, is_spicy:false, is_vegetarian:true,  is_available:true, is_featured:false, is_popular:false, is_best_seller:false, chef_recommended:false, rating:4.6, review_count:38,  calories:380, discount:0 },
  { id:3,  tenant_id:1, category_id:1, name:'Sandwich',                name_am:'ሳንድዊች',            description:'Classic breakfast sandwich.',           price:348,  image_url:'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=400&q=80',  prep_time:10, is_spicy:false, is_vegetarian:false, is_available:true, is_featured:false, is_popular:true,  is_best_seller:false, chef_recommended:false, rating:4.5, review_count:62,  calories:450, discount:0 },
  { id:4,  tenant_id:1, category_id:1, name:'Fatira',                  name_am:'ፋጢራ',              description:'Ethiopian-style crispy pastry.',        price:348,  image_url:'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&q=80',  prep_time:12, is_spicy:false, is_vegetarian:true,  is_available:true, is_featured:true,  is_popular:true,  is_best_seller:true,  chef_recommended:false, rating:4.8, review_count:89,  calories:420, discount:0 },
  { id:5,  tenant_id:1, category_id:1, name:'Special Breakfast',       name_am:'ልዩ ቁርስ',           description:'Full breakfast platter.',               price:957,  image_url:'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=400&q=80',  prep_time:15, is_spicy:false, is_vegetarian:false, is_available:true, is_featured:true,  is_popular:true,  is_best_seller:true,  chef_recommended:true,  rating:4.9, review_count:112, calories:780, discount:0 },
  { id:6,  tenant_id:1, category_id:2, name:'Margherita Pizza',        name_am:'ማርጌሪታ ፒዛ',        description:'Classic tomato, mozzarella, basil.',    price:1300, image_url:'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&q=80',  prep_time:18, is_spicy:false, is_vegetarian:true,  is_available:true, is_featured:true,  is_popular:true,  is_best_seller:true,  chef_recommended:false, rating:4.8, review_count:156, calories:680, discount:0 },
  { id:7,  tenant_id:1, category_id:2, name:'Mediterranean Pizza',     name_am:'ጾም ፒዛ',            description:'Vegan-friendly with fresh vegetables.', price:739,  image_url:'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80',  prep_time:18, is_spicy:false, is_vegetarian:true,  is_available:true, is_featured:false, is_popular:true,  is_best_seller:false, chef_recommended:false, rating:4.6, review_count:78,  calories:580, discount:0 },
  { id:8,  tenant_id:1, category_id:2, name:'Con Pollo Pizza',         name_am:'ዶሮ ፒዛ',            description:'Grilled chicken, roasted peppers.',     price:1609, image_url:'https://images.unsplash.com/photo-1548369937-47519962c11a?w=400&q=80',  prep_time:20, is_spicy:false, is_vegetarian:false, is_available:true, is_featured:true,  is_popular:true,  is_best_seller:false, chef_recommended:false, rating:4.8, review_count:134, calories:760, discount:0 },
  { id:9,  tenant_id:1, category_id:2, name:'Diavola / Pepperoni',     name_am:'ፔፐሮኒ ፒዛ',         description:'Spicy pepperoni, mozzarella.',           price:1652, image_url:'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&q=80',  prep_time:20, is_spicy:true,  is_vegetarian:false, is_available:true, is_featured:true,  is_popular:true,  is_best_seller:true,  chef_recommended:false, rating:4.9, review_count:203, calories:820, discount:0 },
  { id:10, tenant_id:1, category_id:2, name:'Special Pizza',           name_am:'ልዩ ፒዛ',            description:'Signature pizza with premium toppings.',price:1826, image_url:'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=400&q=80',  prep_time:22, is_spicy:false, is_vegetarian:false, is_available:true, is_featured:true,  is_popular:true,  is_best_seller:true,  chef_recommended:true,  rating:4.9, review_count:289, calories:920, discount:0 },
  { id:11, tenant_id:1, category_id:2, name:'Tuna Pizza',              name_am:'ቱና ፒዛ',            description:'Italian tuna, capers, olives.',          price:774,  image_url:'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?w=400&q=80',  prep_time:18, is_spicy:false, is_vegetarian:false, is_available:true, is_featured:false, is_popular:false, is_best_seller:false, chef_recommended:false, rating:4.6, review_count:67,  calories:640, discount:0 },
  { id:12, tenant_id:1, category_id:3, name:'Chopped Cheese Beef',     name_am:'ቾፕድ ቺዝ ቢፍ',       description:'Smashed beef patty, melted cheese.',    price:1000, image_url:'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80',  prep_time:15, is_spicy:false, is_vegetarian:false, is_available:true, is_featured:true,  is_popular:true,  is_best_seller:true,  chef_recommended:false, rating:4.9, review_count:312, calories:780, discount:0 },
  { id:13, tenant_id:1, category_id:3, name:'Chopped Cheese Chicken',  name_am:'ቾፕድ ቺዝ ዶሮ',       description:'Crispy chicken, melted cheese.',         price:1100, image_url:'https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=400&q=80',  prep_time:15, is_spicy:false, is_vegetarian:false, is_available:true, is_featured:false, is_popular:true,  is_best_seller:false, chef_recommended:false, rating:4.8, review_count:198, calories:720, discount:0 },
  { id:14, tenant_id:1, category_id:3, name:'Five Stop Burger',        name_am:'ፋይቭ ስቶፕ በርገር',    description:'Double patty, special sauce.',           price:1135, image_url:'https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&q=80',  prep_time:15, is_spicy:false, is_vegetarian:false, is_available:true, is_featured:true,  is_popular:true,  is_best_seller:true,  chef_recommended:true,  rating:4.9, review_count:421, calories:850, discount:0 },
  { id:15, tenant_id:1, category_id:3, name:'Gouda Burger',            name_am:'ጎዳ በርገር',          description:'Beef patty with creamy Gouda.',          price:770,  image_url:'https://images.unsplash.com/photo-1606755962773-d324e9a13086?w=400&q=80',  prep_time:15, is_spicy:false, is_vegetarian:false, is_available:true, is_featured:false, is_popular:true,  is_best_seller:false, chef_recommended:false, rating:4.7, review_count:145, calories:760, discount:0 },
  { id:16, tenant_id:1, category_id:3, name:'Cheddar Burger',          name_am:'ቸዳር በርገር',         description:'Beef with sharp cheddar.',               price:1387, image_url:'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=400&q=80',  prep_time:15, is_spicy:false, is_vegetarian:false, is_available:true, is_featured:false, is_popular:true,  is_best_seller:false, chef_recommended:false, rating:4.8, review_count:167, calories:800, discount:0 },
  { id:17, tenant_id:1, category_id:3, name:'Spicy Mayo Burger',       name_am:'ስፓይሲ ማዮ በርገር',    description:'Beef with house spicy mayo.',            price:1500, image_url:'https://images.unsplash.com/photo-1542574271-7f3b92e6c821?w=400&q=80',  prep_time:15, is_spicy:true,  is_vegetarian:false, is_available:true, is_featured:true,  is_popular:true,  is_best_seller:false, chef_recommended:false, rating:4.8, review_count:189, calories:820, discount:0 },
  { id:18, tenant_id:1, category_id:3, name:'Spicy Mayo Chicken',      name_am:'ስፓይሲ ማዮ ዶሮ',      description:'Crispy chicken with spicy mayo.',        price:1652, image_url:'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=400&q=80',  prep_time:15, is_spicy:true,  is_vegetarian:false, is_available:true, is_featured:false, is_popular:true,  is_best_seller:false, chef_recommended:false, rating:4.7, review_count:156, calories:780, discount:0 },
  { id:19, tenant_id:1, category_id:3, name:'Hot Dog',                 name_am:'ሆት ዶግ',            description:'Grilled frankfurter in soft bun.',       price:1087, image_url:'https://images.unsplash.com/photo-1612392062422-7c0a91a52439?w=400&q=80',  prep_time:10, is_spicy:false, is_vegetarian:false, is_available:true, is_featured:false, is_popular:false, is_best_seller:false, chef_recommended:false, rating:4.5, review_count:88,  calories:520, discount:0 },
  { id:20, tenant_id:1, category_id:3, name:'Veggie Burger',           name_am:'የአትክልት በርገር',     description:'Plant-based patty, fresh greens.',       price:565,  image_url:'https://images.unsplash.com/photo-1520072959219-c595dc870360?w=400&q=80',  prep_time:12, is_spicy:false, is_vegetarian:true,  is_available:true, is_featured:false, is_popular:false, is_best_seller:false, chef_recommended:false, rating:4.4, review_count:54,  calories:420, discount:0 },
  { id:21, tenant_id:1, category_id:3, name:'Five Stop Special (Beef)',name_am:'ፋይቭ ስቶፕ ልዩ (ስጋ)', description:'Double beef, triple cheese.',            price:1739, image_url:'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=400&q=80',  prep_time:18, is_spicy:false, is_vegetarian:false, is_available:true, is_featured:true,  is_popular:true,  is_best_seller:true,  chef_recommended:false, rating:4.9, review_count:267, calories:1050,discount:0 },
  { id:22, tenant_id:1, category_id:3, name:'Five Stop Special (Chkn)',name_am:'ፋይቭ ስቶፕ ልዩ (ዶሮ)', description:'Double chicken, triple cheese.',         price:1826, image_url:'https://images.unsplash.com/photo-1598182198871-d3f4ab4fd181?w=400&q=80',  prep_time:18, is_spicy:false, is_vegetarian:false, is_available:true, is_featured:false, is_popular:true,  is_best_seller:false, chef_recommended:false, rating:4.8, review_count:198, calories:980, discount:0 },
  { id:23, tenant_id:1, category_id:3, name:'Fried Chicken Sandwich',  name_am:'የተጠበሰ ዶሮ ሳንድዊች',  description:'Crispy chicken, coleslaw, pickles.',    price:1352, image_url:'https://images.unsplash.com/photo-1621852004158-f3bc188ace2d?w=400&q=80',  prep_time:15, is_spicy:false, is_vegetarian:false, is_available:true, is_featured:false, is_popular:true,  is_best_seller:false, chef_recommended:false, rating:4.7, review_count:143, calories:720, discount:0 },
  { id:24, tenant_id:1, category_id:3, name:'Sourdough Sandwich',      name_am:'ሳወርዶ ሳንድዊች',       description:'Grilled sourdough with premium fill.',  price:348,  image_url:'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80',  prep_time:10, is_spicy:false, is_vegetarian:false, is_available:true, is_featured:false, is_popular:false, is_best_seller:false, chef_recommended:false, rating:4.5, review_count:76,  calories:480, discount:0 },
  { id:25, tenant_id:1, category_id:4, name:'Falafel Gyro',            name_am:'ፈላፌል ጂሮ',          description:'Crispy falafel, tzatziki in pita.',     price:852,  image_url:'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=400&q=80',  prep_time:12, is_spicy:false, is_vegetarian:true,  is_available:true, is_featured:false, is_popular:true,  is_best_seller:false, chef_recommended:false, rating:4.6, review_count:88,  calories:520, discount:0 },
  { id:26, tenant_id:1, category_id:4, name:'Tuna Gyro',               name_am:'ቱና ጂሮ',            description:'Italian tuna, olives, garlic mayo.',    price:1052, image_url:'https://images.unsplash.com/photo-1561651188-d207bbec4ec3?w=400&q=80',  prep_time:12, is_spicy:false, is_vegetarian:false, is_available:true, is_featured:false, is_popular:false, is_best_seller:false, chef_recommended:false, rating:4.5, review_count:64,  calories:540, discount:0 },
  { id:27, tenant_id:1, category_id:4, name:'Chicken Gyro',            name_am:'ዶሮ ጂሮ',            description:'Marinated grilled chicken in pita.',    price:1296, image_url:'https://images.unsplash.com/photo-1512852939750-1305098529bf?w=400&q=80',  prep_time:14, is_spicy:false, is_vegetarian:false, is_available:true, is_featured:true,  is_popular:true,  is_best_seller:true,  chef_recommended:false, rating:4.8, review_count:178, calories:620, discount:0 },
  { id:28, tenant_id:1, category_id:4, name:'Beef Gyro',               name_am:'ስጋ ጂሮ',            description:'Tender sliced beef in warm pita.',      price:1496, image_url:'https://images.unsplash.com/photo-1554306274-f23873d9a26c?w=400&q=80',  prep_time:14, is_spicy:false, is_vegetarian:false, is_available:true, is_featured:false, is_popular:true,  is_best_seller:false, chef_recommended:false, rating:4.8, review_count:156, calories:680, discount:0 },
  { id:29, tenant_id:1, category_id:4, name:'Lamb Gyro',               name_am:'የበግ ጂሮ',           description:'Premium spiced lamb, tzatziki.',        price:1565, image_url:'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&q=80',  prep_time:16, is_spicy:false, is_vegetarian:false, is_available:true, is_featured:true,  is_popular:true,  is_best_seller:false, chef_recommended:true,  rating:4.9, review_count:134, calories:720, discount:0 },
  { id:30, tenant_id:1, category_id:5, name:'Buffalo Wings',           name_am:'ቡፋሎ ክንፎች',         description:'Crispy wings in tangy buffalo sauce.',  price:1217, image_url:'https://images.unsplash.com/photo-1567234669003-dce7a7a88821?w=400&q=80',  prep_time:20, is_spicy:true,  is_vegetarian:false, is_available:true, is_featured:true,  is_popular:true,  is_best_seller:true,  chef_recommended:false, rating:4.8, review_count:234, calories:680, discount:0 },
  { id:31, tenant_id:1, category_id:5, name:'BBQ Wings',               name_am:'ባርቤኪው ክንፎች',       description:'Slow-smoked wings in sweet BBQ.',       price:1130, image_url:'https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=400&q=80',  prep_time:20, is_spicy:false, is_vegetarian:false, is_available:true, is_featured:false, is_popular:true,  is_best_seller:false, chef_recommended:false, rating:4.7, review_count:189, calories:640, discount:0 },
  { id:32, tenant_id:1, category_id:5, name:'Hot Peri Wings',          name_am:'ሆት ፔሪ ክንፎች',       description:'Wings in signature peri-peri sauce.',   price:1087, image_url:'https://images.unsplash.com/photo-1606755962773-d324e9a13086?w=400&q=80',  prep_time:20, is_spicy:true,  is_vegetarian:false, is_available:true, is_featured:false, is_popular:true,  is_best_seller:false, chef_recommended:false, rating:4.7, review_count:145, calories:620, discount:0 },
  { id:33, tenant_id:1, category_id:5, name:'Extra Hot Peri Wings',    name_am:'ኤክስትራ ሆት ፔሪ',     description:'Extreme heat peri-peri wings.',         price:1130, image_url:'https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?w=400&q=80',  prep_time:20, is_spicy:true,  is_vegetarian:false, is_available:true, is_featured:false, is_popular:false, is_best_seller:false, chef_recommended:false, rating:4.6, review_count:112, calories:640, discount:0 },
  { id:34, tenant_id:1, category_id:5, name:'Lemon & Herb Wings',      name_am:'ሎሚ እና ዕፅ ክንፎች',   description:'Zesty wings with lemon and herbs.',     price:1030, image_url:'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=400&q=80',  prep_time:20, is_spicy:false, is_vegetarian:false, is_available:true, is_featured:false, is_popular:false, is_best_seller:false, chef_recommended:false, rating:4.6, review_count:98,  calories:580, discount:0 },
  { id:35, tenant_id:1, category_id:6, name:'French Fries',            name_am:'ፈረንሳይ ድንች',        description:'Golden crispy fries, lightly salted.',  price:391,  image_url:'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&q=80',  prep_time:10, is_spicy:false, is_vegetarian:true,  is_available:true, is_featured:false, is_popular:true,  is_best_seller:true,  chef_recommended:false, rating:4.6, review_count:267, calories:380, discount:0 },
  { id:36, tenant_id:1, category_id:6, name:'Salad',                   name_am:'ሰላጣ',              description:'Fresh garden salad with dressing.',     price:350,  image_url:'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80',  prep_time:8,  is_spicy:false, is_vegetarian:true,  is_available:true, is_featured:false, is_popular:false, is_best_seller:false, chef_recommended:false, rating:4.4, review_count:78,  calories:120, discount:0 },
  { id:37, tenant_id:1, category_id:6, name:'Salad Falafel',           name_am:'የፈላፌል ሰላጣ',        description:'Garden salad with crispy falafel.',     price:317,  image_url:'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&q=80',  prep_time:8,  is_spicy:false, is_vegetarian:true,  is_available:true, is_featured:false, is_popular:false, is_best_seller:false, chef_recommended:false, rating:4.5, review_count:56,  calories:280, discount:0 },
  { id:38, tenant_id:1, category_id:6, name:'Salad Tuna',              name_am:'ቱና ሰላጣ',           description:'Fresh salad with Italian tuna.',        price:491,  image_url:'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',  prep_time:8,  is_spicy:false, is_vegetarian:false, is_available:true, is_featured:false, is_popular:false, is_best_seller:false, chef_recommended:false, rating:4.4, review_count:44,  calories:240, discount:0 },
  { id:39, tenant_id:1, category_id:6, name:'High Hoe',                name_am:'ሃይ ሆ',             description:'House special side.',                   price:1348, image_url:'https://images.unsplash.com/photo-1432139509613-5c4255815697?w=400&q=80',  prep_time:15, is_spicy:false, is_vegetarian:false, is_available:true, is_featured:false, is_popular:false, is_best_seller:false, chef_recommended:false, rating:4.7, review_count:38,  calories:550, discount:0 },
  { id:40, tenant_id:1, category_id:7, name:'Breakfast Tea',           name_am:'የቁርስ ሻይ',          description:'Hot English breakfast tea.',            price:57,   image_url:'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&q=80',  prep_time:5,  is_spicy:false, is_vegetarian:true,  is_available:true, is_featured:false, is_popular:true,  is_best_seller:false, chef_recommended:false, rating:4.5, review_count:123, calories:15,  discount:0 },
  { id:41, tenant_id:1, category_id:7, name:'Tea',                     name_am:'ሻይ',               description:'Herbal or black tea, served hot.',      price:57,   image_url:'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80',  prep_time:5,  is_spicy:false, is_vegetarian:true,  is_available:true, is_featured:false, is_popular:false, is_best_seller:false, chef_recommended:false, rating:4.4, review_count:89,  calories:10,  discount:0 },
  { id:42, tenant_id:1, category_id:7, name:'Water',                   name_am:'ውሃ',               description:'Still mineral water.',                  price:87,   image_url:'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80',  prep_time:2,  is_spicy:false, is_vegetarian:true,  is_available:true, is_featured:false, is_popular:true,  is_best_seller:false, chef_recommended:false, rating:4.3, review_count:56,  calories:0,   discount:0 },
  { id:43, tenant_id:1, category_id:7, name:'Soft Drink',              name_am:'ለስላሳ',             description:'Coke, Pepsi, Sprite, or Fanta.',        price:130,  image_url:'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80',  prep_time:2,  is_spicy:false, is_vegetarian:true,  is_available:true, is_featured:false, is_popular:true,  is_best_seller:false, chef_recommended:false, rating:4.4, review_count:178, calories:140, discount:0 },
]

const FIVE_STOP_MODIFIER_GROUPS = [
  { id:1, tenant_id:1, name:'Choose Size',  name_am:'መጠን ይምረጡ', required:false, multi_select:false, max_select:1,
    modifiers:[
      { id:1, group_id:1, name:'Regular',         name_am:'መደበኛ',          price:0,   is_available:true },
      { id:2, group_id:1, name:'Large',            name_am:'ትልቅ',           price:150, is_available:true },
    ]},
  { id:2, tenant_id:1, name:'Extra Sauce',  name_am:'ተጨማሪ ሶስ',  required:false, multi_select:true,  max_select:3,
    modifiers:[
      { id:3,  group_id:2, name:'Ketchup',          name_am:'ኬቸፕ',          price:65,  is_available:true },
      { id:4,  group_id:2, name:'BBQ Sauce',         name_am:'ባርቤኪው ሶስ',    price:109, is_available:true },
      { id:5,  group_id:2, name:'Mayo',              name_am:'ማዮ',           price:130, is_available:true },
      { id:6,  group_id:2, name:'Spicy Mayo',        name_am:'ስፓይሲ ማዮ',     price:130, is_available:true },
      { id:7,  group_id:2, name:'Buffalo Sauce',     name_am:'ቡፋሎ ሶስ',      price:196, is_available:true },
      { id:8,  group_id:2, name:'Peri Peri Sauce',   name_am:'ፔሪ ፔሪ ሶስ',    price:196, is_available:true },
      { id:9,  group_id:2, name:'Garlic Mayo',       name_am:'ጃርሊክ ማዮ',     price:152, is_available:true },
      { id:10, group_id:2, name:'Green Chilli Sauce',name_am:'አረንጓዴ ቺሊ',    price:87,  is_available:true },
    ]},
  { id:3, tenant_id:1, name:'Add Extras',   name_am:'ተጨማሪ ጨምር',  required:false, multi_select:true,  max_select:5,
    modifiers:[
      { id:11, group_id:3, name:'Extra Cheese',      name_am:'ተጨማሪ ቺዝ',    price:252, is_available:true },
      { id:12, group_id:3, name:'Bacon',             name_am:'ቤኮን',          price:174, is_available:true },
      { id:13, group_id:3, name:'Egg',               name_am:'እንቁላል',        price:78,  is_available:true },
      { id:14, group_id:3, name:'Avocado',           name_am:'አቮካዶ',         price:170, is_available:true },
      { id:15, group_id:3, name:'Mushrooms',         name_am:'ፈንገስ',         price:96,  is_available:true },
      { id:16, group_id:3, name:'Jalapeño',          name_am:'ጃላፔኖ',         price:96,  is_available:true },
      { id:17, group_id:3, name:'Pickles',           name_am:'ፒክልስ',         price:96,  is_available:true },
      { id:18, group_id:3, name:'French Fries',      name_am:'ፈረንሳይ ድንች',   price:261, is_available:true },
    ]},
  { id:4, tenant_id:1, name:'Add a Drink',  name_am:'መጠጥ ጨምር',   required:false, multi_select:false, max_select:1,
    modifiers:[
      { id:19, group_id:4, name:'Water',             name_am:'ውሃ',           price:87,  is_available:true },
      { id:20, group_id:4, name:'Soft Drink',        name_am:'ለስላሳ',         price:130, is_available:true },
      { id:21, group_id:4, name:'Tea',               name_am:'ሻይ',           price:57,  is_available:true },
    ]},
]

const FIVE_STOP_TABLES = [
  { id:1, tenant_id:1, number:'1',         capacity:2, status:'available' },
  { id:2, tenant_id:1, number:'2',         capacity:4, status:'available' },
  { id:3, tenant_id:1, number:'3',         capacity:4, status:'available' },
  { id:4, tenant_id:1, number:'4',         capacity:6, status:'available' },
  { id:5, tenant_id:1, number:'5',         capacity:2, status:'available' },
  { id:6, tenant_id:1, number:'6',         capacity:8, status:'available' },
  { id:7, tenant_id:1, number:'VIP 1',     capacity:4, status:'available' },
  { id:8, tenant_id:1, number:'Terrace 1', capacity:6, status:'available' },
]

function generateStarterMenuForTenant(tenantId, tenantName) {
  const cBase = tenantId * 100
  const iBase = tenantId * 1000
  const mBase = tenantId * 100

  const categories = [
    { id: cBase + 1, tenant_id: tenantId, name: 'Chef Specials', name_am: 'የሼፍ ልዩ', icon: '⭐', color: '#f59e0b', sort_order: 1, is_active: true },
    { id: cBase + 2, tenant_id: tenantId, name: 'Main Courses', name_am: 'ዋና ምግቦች', icon: '🍽️', color: '#e11d48', sort_order: 2, is_active: true },
    { id: cBase + 3, tenant_id: tenantId, name: 'Fast Bites & Burgers', name_am: 'ፈጣን ምግቦች', icon: '🍔', color: '#d97706', sort_order: 3, is_active: true },
    { id: cBase + 4, tenant_id: tenantId, name: 'Drinks & Beverages', name_am: 'መጠጦች', icon: '🥤', color: '#0284c7', sort_order: 4, is_active: true },
    { id: cBase + 5, tenant_id: tenantId, name: 'Desserts', name_am: 'ጣፋጭ ምግቦች', icon: '🍰', color: '#9333ea', sort_order: 5, is_active: true },
  ]

  const menuItems = [
    {
      id: iBase + 1, tenant_id: tenantId, category_id: cBase + 1,
      name: `${tenantName} Signature Special`, name_am: 'ልዩ የቤቱ ምግብ',
      description: `House specialty prepared fresh with premium seasoned ingredients and signature sauce.`,
      price: 520, image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&q=80',
      prep_time: 20, is_spicy: false, is_vegetarian: false, is_available: true,
      is_featured: true, is_popular: true, is_best_seller: true, chef_recommended: true,
      rating: 4.9, review_count: 84, calories: 750, discount: 0
    },
    {
      id: iBase + 2, tenant_id: tenantId, category_id: cBase + 2,
      name: 'Grilled Beef Steak', name_am: 'የተጠበሰ የበሬ ስጋ',
      description: 'Tender juicy grilled steak served with roasted potatoes and herb butter.',
      price: 680, image_url: 'https://images.unsplash.com/photo-1558030006-450675393462?w=500&q=80',
      prep_time: 22, is_spicy: false, is_vegetarian: false, is_available: true,
      is_featured: true, is_popular: true, is_best_seller: false, chef_recommended: true,
      rating: 4.8, review_count: 52, calories: 820, discount: 0
    },
    {
      id: iBase + 3, tenant_id: tenantId, category_id: cBase + 2,
      name: 'Roasted Herb Chicken', name_am: 'የተጠበሰ የዶሮ ስጋ',
      description: 'Half farm chicken roasted crisp with fresh rosemary, garlic, and wild rice.',
      price: 490, image_url: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=500&q=80',
      prep_time: 18, is_spicy: false, is_vegetarian: false, is_available: true,
      is_featured: false, is_popular: true, is_best_seller: true, chef_recommended: false,
      rating: 4.7, review_count: 41, calories: 680, discount: 0
    },
    {
      id: iBase + 4, tenant_id: tenantId, category_id: cBase + 3,
      name: `${tenantName} Classic Burger`, name_am: 'ክላሲክ በርገር',
      description: 'Fresh grilled patty with cheddar, crisp lettuce, tomato, and house burger sauce.',
      price: 360, image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80',
      prep_time: 15, is_spicy: false, is_vegetarian: false, is_available: true,
      is_featured: true, is_popular: true, is_best_seller: true, chef_recommended: false,
      rating: 4.9, review_count: 98, calories: 650, discount: 0
    },
    {
      id: iBase + 5, tenant_id: tenantId, category_id: cBase + 3,
      name: 'Crispy Wings & Fries', name_am: 'ክንፎች ከድንች ጋር',
      description: 'Golden fried chicken wings tossed in your choice of barbecue or spicy glaze.',
      price: 340, image_url: 'https://images.unsplash.com/photo-1567234669003-dce7a7a88821?w=500&q=80',
      prep_time: 14, is_spicy: true, is_vegetarian: false, is_available: true,
      is_featured: false, is_popular: true, is_best_seller: false, chef_recommended: false,
      rating: 4.6, review_count: 36, calories: 590, discount: 0
    },
    {
      id: iBase + 6, tenant_id: tenantId, category_id: cBase + 4,
      name: 'Fresh Fruit Juice Blend', name_am: 'ትኩስ ጭማቂ',
      description: 'Freshly squeezed mango, strawberry, avocado, or mixed tropical juice.',
      price: 140, image_url: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=500&q=80',
      prep_time: 5, is_spicy: false, is_vegetarian: true, is_available: true,
      is_featured: true, is_popular: true, is_best_seller: false, chef_recommended: false,
      rating: 4.8, review_count: 65, calories: 180, discount: 0
    },
    {
      id: iBase + 7, tenant_id: tenantId, category_id: cBase + 4,
      name: 'Special Roast Coffee / Tea', name_am: 'ቡና እና ሻይ',
      description: 'Single-origin Ethiopian roasted coffee or spiced aromatic tea.',
      price: 60, image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&q=80',
      prep_time: 4, is_spicy: false, is_vegetarian: true, is_available: true,
      is_featured: false, is_popular: true, is_best_seller: true, chef_recommended: false,
      rating: 4.9, review_count: 142, calories: 20, discount: 0
    },
    {
      id: iBase + 8, tenant_id: tenantId, category_id: cBase + 5,
      name: 'Warm Chocolate Fondant', name_am: 'ቸኮሌት ኬክ',
      description: 'Decadent molten chocolate cake served with vanilla bean ice cream.',
      price: 260, image_url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&q=80',
      prep_time: 10, is_spicy: false, is_vegetarian: true, is_available: true,
      is_featured: true, is_popular: false, is_best_seller: false, chef_recommended: true,
      rating: 4.8, review_count: 29, calories: 420, discount: 0
    }
  ]

  const modifierGroups = [
    {
      id: mBase + 1, tenant_id: tenantId, name: 'Portion Size', name_am: 'መጠን',
      required: false, multi_select: false, max_select: 1,
      modifiers: [
        { id: mBase * 10 + 1, group_id: mBase + 1, name: 'Regular', name_am: 'መደበኛ', price: 0, is_available: true },
        { id: mBase * 10 + 2, group_id: mBase + 1, name: 'Large (+50%)', name_am: 'ትልቅ', price: 120, is_available: true }
      ]
    },
    {
      id: mBase + 2, tenant_id: tenantId, name: 'Add Extras & Sides', name_am: 'ተጨማሪ',
      required: false, multi_select: true, max_select: 3,
      modifiers: [
        { id: mBase * 10 + 3, group_id: mBase + 2, name: 'Extra Cheese', name_am: 'ተጨማሪ ቺዝ', price: 60, is_available: true },
        { id: mBase * 10 + 4, group_id: mBase + 2, name: 'Side French Fries', name_am: 'ድንች', price: 90, is_available: true },
        { id: mBase * 10 + 5, group_id: mBase + 2, name: 'House Sauce', name_am: 'ሶስ', price: 40, is_available: true }
      ]
    }
  ]

  const tables = [
    { id: tenantId * 10 + 1, tenant_id: tenantId, number: '1', capacity: 2, status: 'available' },
    { id: tenantId * 10 + 2, tenant_id: tenantId, number: '2', capacity: 4, status: 'available' },
    { id: tenantId * 10 + 3, tenant_id: tenantId, number: '3', capacity: 4, status: 'available' },
    { id: tenantId * 10 + 4, tenant_id: tenantId, number: '4', capacity: 6, status: 'available' },
    { id: tenantId * 10 + 5, tenant_id: tenantId, number: '5', capacity: 8, status: 'available' },
  ]

  return { categories, menuItems, modifierGroups, tables }
}

function load() {
  let parsed = null
  try {
    if (fs.existsSync(FILE)) {
      parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'))
    }
  } catch (_) {}

  if (!parsed || typeof parsed !== 'object') {
    parsed = {}
  }

  if (!Array.isArray(parsed.tenants) || parsed.tenants.length === 0) {
    parsed.tenants = [DEFAULT_TENANT]
  }
  if (!Array.isArray(parsed.plans)) parsed.plans = DEFAULT_PLANS
  if (!Array.isArray(parsed.users)) parsed.users = DEFAULT_USERS
  if (!Array.isArray(parsed.deliveryZones)) {
    parsed.deliveryZones = [
      { id: 1, tenant_id: 1, zone_name: 'Bole & Around', min_order_amount: 200, delivery_fee: 100, estimated_delivery_minutes: 30, is_active: true },
      { id: 2, tenant_id: 1, zone_name: 'Kazanchis & Kirkos', min_order_amount: 300, delivery_fee: 150, estimated_delivery_minutes: 45, is_active: true }
    ]
  }
  if (!Array.isArray(parsed.orders)) parsed.orders = []
  if (!Array.isArray(parsed.orderItems)) parsed.orderItems = []

  // Ensure persistent categories array
  if (!Array.isArray(parsed.categories)) {
    parsed.categories = [...FIVE_STOP_CATEGORIES]
  }
  // Ensure persistent menuItems array
  if (!Array.isArray(parsed.menuItems)) {
    parsed.menuItems = [...FIVE_STOP_MENU_ITEMS]
  }
  // Ensure persistent modifierGroups array
  if (!Array.isArray(parsed.modifierGroups)) {
    parsed.modifierGroups = [...FIVE_STOP_MODIFIER_GROUPS]
  }
  // Ensure persistent tables array
  if (!Array.isArray(parsed.tables)) {
    parsed.tables = [...FIVE_STOP_TABLES]
  }

  // Ensure each registered tenant has starter categories & menu items so menus are never empty!
  let modified = false
  for (const tenant of parsed.tenants) {
    if (tenant.id === 1) continue
    const hasCats = parsed.categories.some(c => c.tenant_id === tenant.id)
    if (!hasCats) {
      const starter = generateStarterMenuForTenant(tenant.id, tenant.name || 'Restaurant')
      parsed.categories.push(...starter.categories)
      parsed.menuItems.push(...starter.menuItems)
      parsed.modifierGroups.push(...starter.modifierGroups)
      parsed.tables.push(...starter.tables)
      modified = true
    }
  }

  if (modified) {
    save(parsed)
  }

  return parsed
}

function save(data) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8')
  } catch (err) {
    console.error('Error saving data.json:', err.message)
  }
}

// ── TENANT MANAGEMENT ──────────────────────────────────────────────────────────

function getTenants() {
  const data = load()
  return data.tenants
}

function getTenantById(id) {
  const data = load()
  return data.tenants.find(t => t.id === Number(id)) || null
}

function getTenantBySlug(slug) {
  const data = load()
  if (!slug) return null
  const clean = String(slug).toLowerCase().trim()
  return data.tenants.find(t =>
    t.slug?.toLowerCase() === clean ||
    String(t.id) === clean
  ) || null
}

function createTenant({ name, slug, email, phone, address, plan_id, admin_password }) {
  const data = load()
  const cleanSlug = (slug || name).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

  // Calculate next IDs
  const maxTenantId = data.tenants.reduce((m, t) => Math.max(m, t.id || 0), 0)
  const tenantId = maxTenantId + 1

  const tenant = {
    id: tenantId,
    name: name.trim(),
    name_am: '',
    slug: cleanSlug,
    tagline: 'Fresh Flavors & Exceptional Dining',
    description: `Welcome to ${name.trim()}! Enjoy our freshly prepared dishes and swift service.`,
    logo_url: '',
    cover_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80',
    email: email.trim(),
    phone: phone || '',
    address: address || 'Addis Ababa, Ethiopia',
    wifi_password: '',
    working_hours: 'Mon–Sun: 8:00 AM – 10:00 PM',
    status: 'active',
    subscription_plan_id: plan_id || 1,
    subscription_status: 'trialing',
    vat_rate: 0.15,
    service_charge_rate: 0.10,
    currency: 'ETB',
    delivery_enabled: true,
    created_at: new Date().toISOString()
  }

  data.tenants.push(tenant)

  // Create admin user for tenant
  const maxUserId = data.users.reduce((m, u) => Math.max(m, u.id || 0), 0)
  const user = {
    id: maxUserId + 1,
    name: `${name} Admin`,
    email: email.trim(),
    role: 'admin',
    tenant_id: tenant.id,
    is_active: true
  }
  data.users.push(user)

  // Seed starter menu for the newly created tenant so the restaurant is immediately ready!
  const starter = generateStarterMenuForTenant(tenant.id, tenant.name)
  data.categories.push(...starter.categories)
  data.menuItems.push(...starter.menuItems)
  data.modifierGroups.push(...starter.modifierGroups)
  data.tables.push(...starter.tables)

  save(data)
  return { tenant, user }
}

function updateTenant(tenantId, updateData) {
  const data = load()
  const idx = data.tenants.findIndex(t => t.id === Number(tenantId))
  if (idx !== -1) {
    data.tenants[idx] = {
      ...data.tenants[idx],
      ...updateData,
      updated_at: new Date().toISOString()
    }
    save(data)
    return data.tenants[idx]
  }
  return null
}

function updateTenantStatus(tenantId, status, planId) {
  const data = load()
  const tenant = data.tenants.find(t => t.id === Number(tenantId))
  if (tenant) {
    if (status) tenant.status = status
    if (planId) tenant.subscription_plan_id = Number(planId)
    save(data)
    return tenant
  }
  return null
}

function deleteTenant(tenantId) {
  const data = load()
  const tid = Number(tenantId)
  data.tenants = data.tenants.filter(t => t.id !== tid)
  data.users = data.users.filter(u => u.tenant_id !== tid)
  data.categories = data.categories.filter(c => c.tenant_id !== tid)
  data.menuItems = data.menuItems.filter(i => i.tenant_id !== tid)
  data.modifierGroups = data.modifierGroups.filter(g => g.tenant_id !== tid)
  data.tables = data.tables.filter(t => t.tenant_id !== tid)
  data.orders = data.orders.filter(o => o.tenant_id !== tid)
  save(data)
  return true
}

// ── CATEGORIES MANAGEMENT ─────────────────────────────────────────────────────

function getCategories(tenantId, activeOnly = false) {
  const data = load()
  const tid = Number(tenantId)
  let cats = data.categories.filter(c => c.tenant_id === tid)
  if (activeOnly) {
    cats = cats.filter(c => c.is_active !== false)
  }
  return cats.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
}

function getCategoryById(id, tenantId) {
  const data = load()
  return data.categories.find(c => c.id === Number(id) && c.tenant_id === Number(tenantId)) || null
}

function createCategory(tenantId, { name, name_am, icon, color, sort_order }) {
  const data = load()
  const maxId = data.categories.reduce((m, c) => Math.max(m, c.id || 0), 0)
  const newCat = {
    id: maxId + 1,
    tenant_id: Number(tenantId),
    name: name.trim(),
    name_am: name_am || '',
    icon: icon || '🍽️',
    color: color || '#e85d04',
    sort_order: parseInt(sort_order) || 0,
    is_active: true
  }
  data.categories.push(newCat)
  save(data)
  return newCat
}

function updateCategory(id, tenantId, updateData) {
  const data = load()
  const idx = data.categories.findIndex(c => c.id === Number(id) && c.tenant_id === Number(tenantId))
  if (idx !== -1) {
    data.categories[idx] = {
      ...data.categories[idx],
      ...updateData
    }
    save(data)
    return data.categories[idx]
  }
  return null
}

function deleteCategory(id, tenantId) {
  const data = load()
  const cid = Number(id)
  const tid = Number(tenantId)
  data.categories = data.categories.filter(c => !(c.id === cid && c.tenant_id === tid))
  // Also remove menu items belonging to this category
  data.menuItems = data.menuItems.filter(i => !(i.category_id === cid && i.tenant_id === tid))
  save(data)
  return true
}

// ── MENU ITEMS MANAGEMENT ─────────────────────────────────────────────────────

function getMenuItems(tenantId, categoryId, activeOnly = false) {
  const data = load()
  const tid = Number(tenantId)
  let items = data.menuItems.filter(i => i.tenant_id === tid)
  if (categoryId) {
    items = items.filter(i => i.category_id === Number(categoryId))
  }
  if (activeOnly) {
    items = items.filter(i => i.is_available !== false)
  }
  return items.sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1
    if (!a.is_featured && b.is_featured) return 1
    return a.name.localeCompare(b.name)
  })
}

function getFeaturedMenuItems(tenantId) {
  const data = load()
  return data.menuItems.filter(i => i.tenant_id === Number(tenantId) && i.is_featured && i.is_available !== false)
}

function searchMenuItems(tenantId, queryStr) {
  const data = load()
  const tid = Number(tenantId)
  const q = (queryStr || '').toLowerCase().trim()
  return data.menuItems.filter(i =>
    i.tenant_id === tid &&
    i.is_available !== false &&
    (
      i.name.toLowerCase().includes(q) ||
      (i.name_am && i.name_am.toLowerCase().includes(q)) ||
      (i.description && i.description.toLowerCase().includes(q))
    )
  )
}

function getMenuItemById(id, tenantId) {
  const data = load()
  return data.menuItems.find(i => i.id === Number(id) && i.tenant_id === Number(tenantId)) || null
}

function createMenuItem(tenantId, itemData) {
  const data = load()
  const maxId = data.menuItems.reduce((m, i) => Math.max(m, i.id || 0), 0)
  const newItem = {
    id: maxId + 1,
    tenant_id: Number(tenantId),
    category_id: parseInt(itemData.category_id),
    name: itemData.name.trim(),
    name_am: itemData.name_am || '',
    description: itemData.description || '',
    description_am: itemData.description_am || '',
    price: parseFloat(itemData.price) || 0,
    image_url: itemData.image_url || '',
    prep_time: parseInt(itemData.prep_time) || 15,
    is_spicy: !!itemData.is_spicy,
    is_vegetarian: !!itemData.is_vegetarian,
    is_available: itemData.is_available !== false,
    is_featured: !!itemData.is_featured,
    is_popular: !!itemData.is_popular,
    is_best_seller: !!itemData.is_best_seller,
    chef_recommended: !!itemData.chef_recommended,
    rating: parseFloat(itemData.rating) || 4.8,
    review_count: parseInt(itemData.review_count) || 0,
    calories: itemData.calories ? parseInt(itemData.calories) : null,
    discount: parseFloat(itemData.discount) || 0,
    allergens: Array.isArray(itemData.allergens) ? itemData.allergens.join(',') : (itemData.allergens || ''),
    created_at: new Date().toISOString()
  }
  data.menuItems.push(newItem)
  save(data)
  return newItem
}

function updateMenuItem(id, tenantId, itemData) {
  const data = load()
  const idx = data.menuItems.findIndex(i => i.id === Number(id) && i.tenant_id === Number(tenantId))
  if (idx !== -1) {
    data.menuItems[idx] = {
      ...data.menuItems[idx],
      ...itemData,
      category_id: itemData.category_id ? parseInt(itemData.category_id) : data.menuItems[idx].category_id,
      price: itemData.price !== undefined ? parseFloat(itemData.price) : data.menuItems[idx].price,
      updated_at: new Date().toISOString()
    }
    save(data)
    return data.menuItems[idx]
  }
  return null
}

function deleteMenuItem(id, tenantId) {
  const data = load()
  const iid = Number(id)
  const tid = Number(tenantId)
  data.menuItems = data.menuItems.filter(i => !(i.id === iid && i.tenant_id === tid))
  save(data)
  return true
}

// ── MODIFIERS MANAGEMENT ──────────────────────────────────────────────────────

function getModifierGroups(tenantId, publicOnly = false) {
  const data = load()
  const tid = Number(tenantId)
  let groups = data.modifierGroups.filter(g => g.tenant_id === tid)
  if (publicOnly) {
    groups = groups.map(g => ({
      ...g,
      modifiers: (g.modifiers || []).filter(m => m.is_available !== false)
    }))
  }
  return groups
}

function createModifierGroup(tenantId, groupData) {
  const data = load()
  const maxId = data.modifierGroups.reduce((m, g) => Math.max(m, g.id || 0), 0)
  const newGroup = {
    id: maxId + 1,
    tenant_id: Number(tenantId),
    name: groupData.name.trim(),
    name_am: groupData.name_am || '',
    required: !!groupData.required,
    multi_select: !!groupData.multi_select,
    max_select: parseInt(groupData.max_select) || 1,
    modifiers: []
  }
  data.modifierGroups.push(newGroup)
  save(data)
  return newGroup
}

function updateModifierGroup(id, tenantId, groupData) {
  const data = load()
  const idx = data.modifierGroups.findIndex(g => g.id === Number(id) && g.tenant_id === Number(tenantId))
  if (idx !== -1) {
    data.modifierGroups[idx] = {
      ...data.modifierGroups[idx],
      ...groupData
    }
    save(data)
    return data.modifierGroups[idx]
  }
  return null
}

function deleteModifierGroup(id, tenantId) {
  const data = load()
  data.modifierGroups = data.modifierGroups.filter(g => !(g.id === Number(id) && g.tenant_id === Number(tenantId)))
  save(data)
  return true
}

function createModifier(groupId, modData) {
  const data = load()
  const gid = Number(groupId)
  const group = data.modifierGroups.find(g => g.id === gid)
  if (!group) return null
  if (!Array.isArray(group.modifiers)) group.modifiers = []
  const maxModId = data.modifierGroups.reduce((m, g) => {
    return Math.max(m, ...(g.modifiers || []).map(mod => mod.id || 0))
  }, 0)
  const newMod = {
    id: maxModId + 1,
    group_id: gid,
    name: modData.name.trim(),
    name_am: modData.name_am || '',
    price: parseFloat(modData.price) || 0,
    is_available: modData.is_available !== false
  }
  group.modifiers.push(newMod)
  save(data)
  return newMod
}

function updateModifier(id, modData) {
  const data = load()
  const mid = Number(id)
  for (const group of data.modifierGroups) {
    const mIdx = (group.modifiers || []).findIndex(m => m.id === mid)
    if (mIdx !== -1) {
      group.modifiers[mIdx] = {
        ...group.modifiers[mIdx],
        ...modData,
        price: modData.price !== undefined ? parseFloat(modData.price) : group.modifiers[mIdx].price
      }
      save(data)
      return group.modifiers[mIdx]
    }
  }
  return null
}

function deleteModifier(id) {
  const data = load()
  const mid = Number(id)
  for (const group of data.modifierGroups) {
    if (Array.isArray(group.modifiers)) {
      group.modifiers = group.modifiers.filter(m => m.id !== mid)
    }
  }
  save(data)
  return true
}

// ── TABLES MANAGEMENT ─────────────────────────────────────────────────────────

function getTables(tenantId) {
  const data = load()
  return data.tables.filter(t => t.tenant_id === Number(tenantId))
}

function createTable(tenantId, tableData) {
  const data = load()
  const maxId = data.tables.reduce((m, t) => Math.max(m, t.id || 0), 0)
  const newTable = {
    id: maxId + 1,
    tenant_id: Number(tenantId),
    number: String(tableData.number).trim(),
    capacity: parseInt(tableData.capacity) || 4,
    status: tableData.status || 'available'
  }
  data.tables.push(newTable)
  save(data)
  return newTable
}

function updateTable(id, tenantId, tableData) {
  const data = load()
  const idx = data.tables.findIndex(t => t.id === Number(id) && t.tenant_id === Number(tenantId))
  if (idx !== -1) {
    data.tables[idx] = {
      ...data.tables[idx],
      ...tableData
    }
    save(data)
    return data.tables[idx]
  }
  return null
}

function deleteTable(id, tenantId) {
  const data = load()
  data.tables = data.tables.filter(t => !(t.id === Number(id) && t.tenant_id === Number(tenantId)))
  save(data)
  return true
}

// ── ORDERS MANAGEMENT ─────────────────────────────────────────────────────────

function createOrder({
  tenantId, tableNumber, customerName, phone, notes, status,
  subtotal, vat, serviceCharge, grandTotal, estimatedTime,
  orderType, pickupNumber, pickupTime, deliveryAddress, deliveryLat, deliveryLng,
}) {
  const data = load()
  const maxId = data.orders.reduce((m, o) => Math.max(m, o.id || 0), 0)
  const order = {
    id: maxId + 1,
    tenant_id: Number(tenantId) || 1,
    order_ref: `ORD-${Date.now()}`,
    table_number: String(tableNumber || ''),
    customer_name: customerName || '',
    phone: phone || '',
    notes: notes || '',
    status: status || 'new',
    delivery_status: null,
    subtotal: parseFloat(subtotal) || 0,
    vat: parseFloat(vat) || 0,
    service_charge: parseFloat(serviceCharge) || 0,
    grand_total: parseFloat(grandTotal) || 0,
    estimated_time: parseInt(estimatedTime) || 20,
    order_type: orderType || 'dine_in',
    pickup_number: pickupNumber || '',
    pickup_time: pickupTime || '',
    delivery_address: deliveryAddress || '',
    delivery_lat: parseFloat(deliveryLat) || null,
    delivery_lng: parseFloat(deliveryLng) || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  data.orders.unshift(order)
  save(data)
  return order
}

function addOrderItem({ orderId, name, price, qty, modifiers, specialInstructions }) {
  const data = load()
  const item = {
    id: Date.now() + Math.random(),
    order_id: orderId,
    menu_item_name: name || '',
    price: parseFloat(price) || 0,
    quantity: parseInt(qty) || 1,
    modifiers: modifiers || '',
    special_instructions: specialInstructions || '',
    item_total: (parseFloat(price) || 0) * (parseInt(qty) || 1),
  }
  data.orderItems.push(item)
  save(data)
  return item
}

function getOrders(statusFilter, tenantId) {
  const data = load()
  let orders = data.orders
  if (tenantId) orders = orders.filter(o => o.tenant_id === Number(tenantId))
  if (statusFilter) orders = orders.filter(o => o.status === statusFilter)
  return orders.map(o => ({
    ...o,
    items: data.orderItems.filter(i => i.order_id === o.id),
  }))
}

function getOrderById(id) {
  const data = load()
  const order = data.orders.find(o => o.id === Number(id) || o.order_ref === String(id))
  if (!order) return null
  return { ...order, items: data.orderItems.filter(i => i.order_id === order.id) }
}

function updateOrderStatus(id, status, deliveryStatus) {
  const data = load()
  const order = data.orders.find(o => o.id === Number(id))
  if (order) {
    if (status) order.status = status
    if (deliveryStatus) order.delivery_status = deliveryStatus
    order.updated_at = new Date().toISOString()
    save(data)
    return order
  }
  return null
}

function deleteOrder(id) {
  const data = load()
  data.orders = data.orders.filter(o => o.id !== Number(id))
  data.orderItems = data.orderItems.filter(i => i.order_id !== Number(id))
  save(data)
}

function getPlans() {
  const data = load()
  return data.plans
}

function getUsers() {
  const data = load()
  return data.users
}

function getUserByEmail(email) {
  const data = load()
  if (!email) return null
  return data.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null
}

function getRiderOrders(riderId) {
  const data = load()
  return data.orders.filter(o => o.order_type === 'delivery')
}

// Seed backward compatibility aliases
function getSeedCategories(tenantId) {
  return getCategories(tenantId)
}

function getSeedMenuItems(tenantId, categoryId) {
  return getMenuItems(tenantId, categoryId)
}

function getSeedModifiers(tenantId) {
  return getModifierGroups(tenantId)
}

function getSeedTables(tenantId) {
  return getTables(tenantId)
}

module.exports = {
  load,
  save,
  // Tenants
  getTenants,
  getTenantById,
  getTenantBySlug,
  createTenant,
  updateTenant,
  updateTenantStatus,
  deleteTenant,
  // Categories
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  // Menu Items
  getMenuItems,
  getFeaturedMenuItems,
  searchMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  // Modifiers
  getModifierGroups,
  createModifierGroup,
  updateModifierGroup,
  deleteModifierGroup,
  createModifier,
  updateModifier,
  deleteModifier,
  // Tables
  getTables,
  createTable,
  updateTable,
  deleteTable,
  // Plans & Users
  getPlans,
  getUsers,
  getUserByEmail,
  // Orders
  createOrder,
  addOrderItem,
  getOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
  getRiderOrders,
  // Seed aliases
  getSeedCategories,
  getSeedMenuItems,
  getSeedModifiers,
  getSeedTables,
}
