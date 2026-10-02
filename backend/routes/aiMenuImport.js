/**
 * AI Menu Import — backend/routes/aiMenuImport.js
 *
 * Supports two import modes:
 *
 *  1. IMAGE mode  — POST /api/ai-menu-import/analyze-image
 *     Upload a photo of a physical menu (or any food image).
 *     Gemini Vision reads it and returns a structured JSON with categories
 *     and menu items including name, price, description, ingredients, flags.
 *
 *  2. EXCEL mode  — POST /api/ai-menu-import/analyze-excel
 *     Upload an .xlsx / .xls / .csv file in ANY column format.
 *     The system auto-detects columns (fuzzy match), groups items by
 *     category, and returns the same structured preview JSON.
 *
 * Both endpoints return the same preview shape:
 * {
 *   categories: [{ name, icon, color }],
 *   items: [{
 *     categoryName, name, nameAm, description, price, calories,
 *     prepTime, isSpicy, isVegetarian, isFeatured, allergens,
 *     ingredients, imagePrompt
 *   }]
 * }
 *
 * The frontend shows this as a review table before the user confirms.
 * On confirm, POST /api/menu-items/bulk saves everything atomically.
 */

const router    = require('express').Router()
const multer    = require('multer')
const XLSX      = require('xlsx')
const sharp     = require('sharp')
const path      = require('path')
const { requireAuth, requireRole } = require('../middleware/auth')
const { resolveTenant }            = require('../middleware/tenant')

router.use(resolveTenant)

// ── Multer: accept image or spreadsheet, max 15 MB ────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ]
    const extOk = /\.(jpg|jpeg|png|webp|gif|xlsx|xls|csv)$/i.test(file.originalname)
    if (allowed.includes(file.mimetype) || extOk) return cb(null, true)
    cb(new Error('Unsupported file type. Upload an image (jpg/png/webp) or spreadsheet (xlsx/xls/csv).'))
  },
})

// ── Gemini helper ─────────────────────────────────────────────────────────────
function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(apiKey)
    return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
  } catch (_) { return null }
}

// ── Category icon/color auto-assignment ───────────────────────────────────────
const CATEGORY_STYLES = [
  { icon: '🍽️',  color: '#e85d04' },
  { icon: '🥩',  color: '#c1121f' },
  { icon: '🐔',  color: '#f4a261' },
  { icon: '🐟',  color: '#2196f3' },
  { icon: '🥗',  color: '#4caf50' },
  { icon: '🍕',  color: '#ff5722' },
  { icon: '🥘',  color: '#9c6644' },
  { icon: '🍜',  color: '#ff9800' },
  { icon: '🍱',  color: '#607d8b' },
  { icon: '🥤',  color: '#00bcd4' },
  { icon: '☕',  color: '#795548' },
  { icon: '🍺',  color: '#ffc107' },
  { icon: '🧃',  color: '#8bc34a' },
  { icon: '🍰',  color: '#e91e63' },
  { icon: '🍦',  color: '#f06292' },
  { icon: '🥐',  color: '#ffb300' },
  { icon: '🍳',  color: '#ff7043' },
  { icon: '🌮',  color: '#ff6f00' },
  { icon: '🥙',  color: '#558b2f' },
  { icon: '🫕',  color: '#a1887f' },
]

function styleForCategory(name, index) {
  const n = (name || '').toLowerCase()
  if (/beef|meat|steak|tibs|kitfo|gored/i.test(n))       return { icon: '🥩', color: '#c1121f' }
  if (/chicken|poultry|doro/i.test(n))                    return { icon: '🐔', color: '#f4a261' }
  if (/fish|seafood|tilapia|nile/i.test(n))               return { icon: '🐟', color: '#2196f3' }
  if (/salad|veg|vegetar|fasting|tsom|green/i.test(n))    return { icon: '🥗', color: '#4caf50' }
  if (/pizza|burger|sandwich|fast/i.test(n))              return { icon: '🍕', color: '#ff5722' }
  if (/soup|stew|wot|shiro|misir/i.test(n))               return { icon: '🥘', color: '#9c6644' }
  if (/pasta|noodle|spaghetti/i.test(n))                  return { icon: '🍜', color: '#ff9800' }
  if (/juice|smoothie|fresh/i.test(n))                    return { icon: '🧃', color: '#8bc34a' }
  if (/coffee|tea|macchiato|buna|chai/i.test(n))          return { icon: '☕', color: '#795548' }
  if (/beer|wine|alcohol|spirits|bar/i.test(n))           return { icon: '🍺', color: '#ffc107' }
  if (/drink|beverag|soft|water|soda/i.test(n))           return { icon: '🥤', color: '#00bcd4' }
  if (/dessert|cake|pastry|sweet|ice cream|chocolate/i.test(n)) return { icon: '🍰', color: '#e91e63' }
  if (/breakfast|injera|firfir/i.test(n))                 return { icon: '🍳', color: '#ff7043' }
  if (/special|chef|signature|featured/i.test(n))         return { icon: '⭐', color: '#ff6f00' }
  if (/combo|set|package|meal/i.test(n))                  return { icon: '🍱', color: '#607d8b' }
  return CATEGORY_STYLES[index % CATEGORY_STYLES.length]
}

// ── Normalise Gemini JSON (sometimes it returns markdown code fences) ─────────
function extractJSON(text) {
  // Strip ```json ... ``` wrapper if present
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (m) text = m[1]
  // Find first { or [
  const start = Math.min(
    text.indexOf('{') === -1 ? Infinity : text.indexOf('{'),
    text.indexOf('[') === -1 ? Infinity : text.indexOf('['),
  )
  if (start === Infinity) return null
  const end = text.lastIndexOf(text[start] === '{' ? '}' : ']')
  if (end === -1) return null
  return JSON.parse(text.slice(start, end + 1))
}

// ── Build a consistent preview item ──────────────────────────────────────────
function normalizeItem(raw) {
  return {
    categoryName:  String(raw.categoryName  || raw.category || 'General'),
    name:          String(raw.name          || raw.itemName || ''),
    nameAm:        String(raw.nameAm        || raw.amharic  || ''),
    description:   String(raw.description   || raw.desc     || ''),
    price:         parseFloat(raw.price)    || 0,
    calories:      parseInt(raw.calories)   || 0,
    prepTime:      parseInt(raw.prepTime    || raw.prep_time) || 15,
    isSpicy:       !!(raw.isSpicy     || raw.is_spicy     || raw.spicy),
    isVegetarian:  !!(raw.isVegetarian|| raw.is_vegetarian|| raw.vegetarian || raw.veg),
    isFeatured:    !!(raw.isFeatured  || raw.is_featured  || raw.featured),
    isBestSeller:  !!(raw.isBestSeller|| raw.is_best_seller),
    allergens:     String(raw.allergens || ''),
    ingredients:   String(raw.ingredients || ''),
    imagePrompt:   String(raw.imagePrompt || raw.name || ''),
  }
}

function buildPreview(rawItems, dedupCategories = true) {
  const items = rawItems.filter(i => i.name).map(normalizeItem)

  // Build unique category list preserving order of first appearance
  const seenCats = new Map()
  items.forEach(item => {
    if (!seenCats.has(item.categoryName)) {
      const idx = seenCats.size
      seenCats.set(item.categoryName, { name: item.categoryName, ...styleForCategory(item.categoryName, idx) })
    }
  })

  return { categories: Array.from(seenCats.values()), items }
}

// ─────────────────────────────────────────────────────────────────────────────
//  ROUTE 1: Analyze a menu PHOTO with Gemini Vision
// ─────────────────────────────────────────────────────────────────────────────
router.post('/analyze-image', requireAuth, requireRole(['admin']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file uploaded' })

    // Re-encode with sharp → JPEG ≤ 1400px for faster Gemini upload
    let imgBuf = req.file.buffer
    try {
      imgBuf = await sharp(imgBuf)
        .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toBuffer()
    } catch (_) { /* use original if sharp fails */ }

    const model = getGeminiModel()

    if (!model) {
      // No API key — return a clear error so the user knows what to do
      return res.status(400).json({
        error: 'AI image analysis requires a Gemini API key. Please add GEMINI_API_KEY to your backend .env file. You can get a free key at https://aistudio.google.com/app/apikey',
        noApiKey: true,
      })
    }

    const prompt = `You are a menu data extraction AI. Analyze this restaurant menu image and extract ALL menu items.

Return ONLY a JSON object in exactly this format (no markdown, no explanation):
{
  "items": [
    {
      "categoryName": "Category name (e.g. Starters, Main Dishes, Beverages)",
      "name": "Item name in English",
      "nameAm": "Item name in Amharic if visible, else empty string",
      "description": "Short description (1-2 sentences)",
      "price": 0,
      "calories": 0,
      "prepTime": 15,
      "isSpicy": false,
      "isVegetarian": false,
      "isFeatured": false,
      "allergens": "comma-separated list or empty",
      "ingredients": "main ingredients comma-separated",
      "imagePrompt": "Short phrase for AI image generation (e.g. 'grilled chicken with salad')"
    }
  ]
}

Rules:
- Extract EVERY item visible. Do not skip any.
- If price is not visible, use 0.
- Group by logical category (e.g. Appetizers, Soups, Main Course, Desserts, Drinks).
- isSpicy = true if the menu shows a chili symbol or says spicy/hot.
- isVegetarian = true if the menu shows (V) or says vegetarian.
- ingredients = list the main ingredients visible or implied.
- imagePrompt = a clear English phrase describing how the dish looks for image generation.`

    const imagePart = {
      inlineData: {
        data: imgBuf.toString('base64'),
        mimeType: 'image/jpeg',
      },
    }

    const result = await model.generateContent([prompt, imagePart])
    const text   = result.response.text()

    let parsed
    try { parsed = extractJSON(text) } catch (e) {
      return res.status(422).json({ error: 'AI could not parse the image as a menu. Please try a clearer menu photo.', raw: text.slice(0, 500) })
    }

    const rawItems = Array.isArray(parsed) ? parsed : (parsed?.items || [])
    if (!rawItems.length) return res.status(422).json({ error: 'No menu items found in image. Try a different photo.' })

    return res.json({ source: 'gemini-vision', ...buildPreview(rawItems) })
  } catch (err) {
    console.error('AI image import error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  ROUTE 2: Parse an Excel/CSV file — auto-detect columns, group by category
// ─────────────────────────────────────────────────────────────────────────────
router.post('/analyze-excel', requireAuth, requireRole(['admin']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    // Parse workbook from buffer
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows  = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    if (!rows.length) return res.status(400).json({ error: 'The spreadsheet appears to be empty.' })

    // ── Auto-detect column mapping (fuzzy) ─────────────────────────────────
    const headers = Object.keys(rows[0])

    const findCol = (...variants) => headers.find(h =>
      variants.some(v => h.toLowerCase().replace(/[\s_\-]/g, '').includes(v.toLowerCase().replace(/[\s_\-]/g, '')))
    )

    const colName        = findCol('name','itemname','productname','dishname','title','ስም')
    const colNameAm      = findCol('amharic','nameam','nameth','nameet','ethiopian')
    const colCategory    = findCol('category','categoryname','catname','section','type','group','ምድብ')
    const colPrice       = findCol('price','cost','amount','birr','etb','rate','ዋጋ')
    const colDesc        = findCol('description','desc','detail','about','note')
    const colCalories    = findCol('calorie','kcal','cal','energy')
    const colPrepTime    = findCol('preptime','prep','time','duration','minutes')
    const colSpicy       = findCol('spicy','hot','chili')
    const colVeg         = findCol('vegetarian','veg','vegan','plant')
    const colFeatured    = findCol('featured','special','highlight','popular','bestsell')
    const colAllergens   = findCol('allergen','allergy')
    const colIngredients = findCol('ingredient','contain','consist','components')
    const colDiscount    = findCol('discount','offer','sale','reduction')

    if (!colName) return res.status(400).json({
      error: 'Could not find a "Name" column. Make sure your spreadsheet has a column for item names.',
      foundColumns: headers,
    })

    const parseBool = (val) => {
      if (typeof val === 'boolean') return val
      if (typeof val === 'number') return val > 0
      return ['yes','true','1','✓','x','✔'].includes(String(val).toLowerCase().trim())
    }

    const rawItems = rows.map(row => ({
      categoryName:  colCategory    ? String(row[colCategory]    || 'General').trim() : 'General',
      name:          colName        ? String(row[colName]        || '').trim()         : '',
      nameAm:        colNameAm      ? String(row[colNameAm]      || '').trim()         : '',
      description:   colDesc        ? String(row[colDesc]        || '').trim()         : '',
      price:         colPrice       ? parseFloat(row[colPrice])  || 0                  : 0,
      calories:      colCalories    ? parseInt(row[colCalories]) || 0                  : 0,
      prepTime:      colPrepTime    ? parseInt(row[colPrepTime]) || 15                 : 15,
      isSpicy:       colSpicy       ? parseBool(row[colSpicy])                         : false,
      isVegetarian:  colVeg         ? parseBool(row[colVeg])                           : false,
      isFeatured:    colFeatured    ? parseBool(row[colFeatured])                      : false,
      allergens:     colAllergens   ? String(row[colAllergens]   || '').trim()         : '',
      ingredients:   colIngredients ? String(row[colIngredients] || '').trim()         : '',
      discount:      colDiscount    ? parseFloat(row[colDiscount]) || 0                : 0,
      imagePrompt:   colName        ? String(row[colName]        || '').trim()         : '',
    })).filter(i => i.name)

    if (!rawItems.length) return res.status(400).json({ error: 'No valid rows found. Make sure Name and Price columns are filled.' })

    // Optional Gemini enhancement: fill in descriptions/ingredients for items missing them
    const model = getGeminiModel()
    const itemsMissingDesc = rawItems.filter(i => !i.description && i.name)

    if (model && itemsMissingDesc.length > 0 && itemsMissingDesc.length <= 30) {
      try {
        const nameList = itemsMissingDesc.map((i, idx) => `${idx + 1}. "${i.name}"`).join('\n')
        const prompt = `For each food/drink item below, write a short 1-sentence menu description (max 15 words) and list 3-4 main ingredients.
Return ONLY a JSON array in this exact format:
[{"name":"item name","description":"description","ingredients":"ingredient1, ingredient2, ingredient3"}]

Items:
${nameList}`

        const result  = await model.generateContent(prompt)
        const text    = result.response.text()
        const enhancements = extractJSON(text)

        if (Array.isArray(enhancements)) {
          enhancements.forEach(e => {
            const item = rawItems.find(i => i.name.toLowerCase() === (e.name || '').toLowerCase())
            if (item) {
              if (!item.description && e.description) item.description = e.description
              if (!item.ingredients && e.ingredients) item.ingredients = e.ingredients
            }
          })
        }
      } catch (_) { /* AI enhancement optional — skip on error */ }
    }

    return res.json({ source: 'excel-parse', ...buildPreview(rawItems) })
  } catch (err) {
    console.error('Excel import error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  ROUTE 3: Download a blank Excel template in the correct format
// ─────────────────────────────────────────────────────────────────────────────
router.get('/template', requireAuth, (req, res) => {
  const wb = XLSX.utils.book_new()
  const template = [
    {
      'Category': 'Main Dishes',
      'Name': 'Tibs Firfir',
      'Name (Amharic)': 'ጥብስ ፍርፍር',
      'Description': 'Sautéed beef mixed with injera pieces',
      'Price': 180,
      'Calories': 450,
      'Prep Time (min)': 15,
      'Is Spicy': 'Yes',
      'Is Vegetarian': 'No',
      'Is Featured': 'Yes',
      'Allergens': '',
      'Ingredients': 'beef, injera, onion, tomato, spices',
      'Discount (%)': 0,
    },
    {
      'Category': 'Beverages',
      'Name': 'Mango Juice',
      'Name (Amharic)': 'ማንጎ ጭማቂ',
      'Description': 'Fresh mango blended with milk',
      'Price': 60,
      'Calories': 180,
      'Prep Time (min)': 5,
      'Is Spicy': 'No',
      'Is Vegetarian': 'Yes',
      'Is Featured': 'No',
      'Allergens': 'milk',
      'Ingredients': 'mango, milk, sugar',
      'Discount (%)': 0,
    },
  ]
  const ws = XLSX.utils.json_to_sheet(template)

  // Set column widths
  ws['!cols'] = [
    { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 40 },
    { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 12 },
    { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 30 }, { wch: 12 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Menu Items')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  res.setHeader('Content-Disposition', 'attachment; filename="mega_menu_template.xlsx"')
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})

module.exports = router
