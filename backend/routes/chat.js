const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')
const { resolveTenant } = require('../middleware/tenant')
const { query } = require('../db')

router.use(resolveTenant)

const sessions = new Map()

function getOrCreate(sessionId, tableNumber = '', tenantId = 1) {
  const key = `${tenantId}:${sessionId}`
  if (!sessions.has(key)) {
    sessions.set(key, {
      id: sessionId,
      tenantId,
      tableNumber,
      messages: [],
      createdAt: new Date().toISOString(),
      unread: 0,
    })
  }
  return sessions.get(key)
}

async function getAIReply(userText, sessionId, tableNumber, tenantId) {
  const text = userText.toLowerCase().trim()
  let menuItems = []
  let restaurantData = {}

  try {
    const [menuRes, restRes] = await Promise.all([
      query(`SELECT name, price, description, category_id, is_available, is_popular, is_spicy, is_vegetarian FROM menu_items WHERE tenant_id = $1 AND is_available=true ORDER BY is_popular DESC, name LIMIT 20`, [tenantId]),
      query(`SELECT name, address, phone, working_hours, wifi_password, vat_rate, service_charge_rate FROM tenants WHERE id = $1`, [tenantId]),
    ])
    menuItems      = menuRes.rows  || []
    restaurantData = restRes.rows[0] || {}
  } catch (_) {}

  const restaurant = restaurantData.name || 'Digital Menu'
  const vatPct     = Math.round((restaurantData.vat_rate || 0.15) * 100)
  const svcPct     = Math.round((restaurantData.service_charge_rate || 0.10) * 100)

  if (/^(hi|hello|hey|hiya|good (morning|afternoon|evening)|selam|salam|ye|ሰላም)/i.test(text)) {
    const greets = [
      `👋 Hello! Welcome to **${restaurant}**! I'm your virtual assistant.\n\nI can help you with:\n• 🍽️ Browse our menu\n• 💰 Prices & specials\n• 📍 Location & hours\n• 📦 Track your order\n• ❓ Any questions\n\nWhat can I get for you today?`,
      `🍽️ Hi there! Welcome to **${restaurant}**! How can I help you today?\n\nAsk me about our menu, prices, hours, or anything else!`,
    ]
    return greets[Math.floor(Math.random() * greets.length)]
  }

  if (/menu|food|eat|order|item|dish|meal|what.*have|what.*serve|show me/i.test(text)) {
    if (menuItems.length === 0) return `🍽️ Our menu is loading... Please check the menu tab for the full list!`
    const topItems = menuItems.slice(0, 8)
    const lines = topItems.map(i => {
      const tags = [i.is_spicy ? '🌶️' : '', i.is_vegetarian ? '🥬' : '', i.is_popular ? '🔥' : ''].filter(Boolean).join(' ')
      return `• **${i.name}** — ${i.price} ETB ${tags}`
    }).join('\n')
    return `🍽️ Here are some of our popular items:\n\n${lines}\n\n👆 Tap **Browse Menu** to see the full menu with images and details!`
  }

  if (/price|cost|how much|birr|etb|expensive|cheap/i.test(text)) {
    if (menuItems.length > 0) {
      const sorted  = [...menuItems].sort((a,b) => a.price - b.price)
      const cheapest = sorted[0]
      const priciest = sorted[sorted.length - 1]
      return `💰 Our prices range from **${cheapest.price} ETB** (${cheapest.name}) to **${priciest.price} ETB** (${priciest.name}).\n\n📋 All prices include:\n• VAT: ${vatPct}%\n• Service charge: ${svcPct}%\n\nWould you like to know the price of a specific item?`
    }
    return `💰 Our prices are very reasonable! Please check the menu for detailed pricing. All prices are in ETB and include ${vatPct}% VAT.`
  }

  if (menuItems.length > 0) {
    const matched = menuItems.find(i =>
      text.includes(i.name.toLowerCase()) ||
      i.name.toLowerCase().split(' ').some(word => word.length > 3 && text.includes(word))
    )
    if (matched) {
      const tags = []
      if (matched.is_spicy) tags.push('🌶️ Spicy')
      if (matched.is_vegetarian) tags.push('🥬 Vegetarian')
      if (matched.is_popular) tags.push('🔥 Popular')
      return `✨ **${matched.name}**\n\n💰 Price: **${matched.price} ETB**\n${tags.length ? tags.join(' · ') + '\n' : ''}${matched.description ? `\n📝 ${matched.description.slice(0, 120)}` : ''}\n\nWould you like to add this to your cart? 🛒`
    }
  }

  if (/hour|open|close|time|when|schedule|working/i.test(text))
    return `🕐 **Working Hours**\n\n${restaurantData.working_hours || 'Mon–Sun: 7:00 AM – 11:00 PM'}\n\nWe're open every day! 😊`

  if (/where|location|address|direction|map|find you|how.*get/i.test(text))
    return `📍 **Our Location**\n\n${restaurantData.address || 'Bole Road, Addis Ababa, Ethiopia'}\n\n📞 Phone: ${restaurantData.phone || '+251 91 859 2028'}`

  if (/wifi|wi-fi|internet|password|network/i.test(text))
    return `📶 **WiFi Access**\n\nPassword: **${restaurantData.wifi_password || 'Ask your waiter'}**`

  if (/phone|call|contact|number|reach/i.test(text))
    return `📞 **Contact Us**\n\nPhone: **${restaurantData.phone || '+251 91 859 2028'}**\nAddress: ${restaurantData.address || 'Bole Road, Addis Ababa'}`

  if (/track|order|status|where.*food|ready|delivered|how long/i.test(text))
    return `📦 **Order Tracking**\n\nGo to **My Orders** in the app to see live status.\n⏱️ Average prep time: 15–25 minutes`

  return `🤔 I'm not quite sure, but I'm connecting you with our team!\n\n🔔 You can also call a waiter or reach us at: ${restaurantData.phone || '+251 91 859 2028'}`
}

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    const { sessionId, tableNumber, message, customerName } = req.body
    if (!sessionId || !message?.trim()) return res.status(400).json({ error: 'sessionId and message required' })

    const session = getOrCreate(sessionId, tableNumber || '', req.tenantId)
    if (customerName && !session.customerName) session.customerName = customerName
    if (tableNumber  && !session.tableNumber)  session.tableNumber  = tableNumber

    const customerMsg = { role: 'customer', text: message.trim(), ts: new Date().toISOString(), id: `${Date.now()}-c` }
    session.messages.push(customerMsg)
    session.unread++
    session.lastActivity = new Date().toISOString()

    const aiText = await getAIReply(message, sessionId, tableNumber, req.tenantId)
    const botMsg = { role: 'bot', text: aiText, ts: new Date().toISOString(), id: `${Date.now()}-b` }
    session.messages.push(botMsg)

    const io = req.app.get('io')
    if (io) {
      io.emit('chat_new_message', {
        sessionId,
        tenantId:     req.tenantId,
        tableNumber:  session.tableNumber,
        customerName: session.customerName || '',
        message:      customerMsg,
        unread:       session.unread,
      })
    }

    res.json({ message: botMsg, sessionId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/chat/:sessionId/reply  (admin)
router.post('/:sessionId/reply', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params
    const { message } = req.body
    const adminUser = req.user

    const key = `${req.tenantId}:${sessionId}`
    if (!sessions.has(key)) return res.status(404).json({ error: 'Session not found' })
    const session = sessions.get(key)

    const adminMsg = {
      role: 'admin',
      text: message.trim(),
      ts: new Date().toISOString(),
      id: `${Date.now()}-a`,
      adminName: adminUser?.name || 'Staff',
    }
    session.messages.push(adminMsg)
    session.lastActivity = new Date().toISOString()

    const io = req.app.get('io')
    if (io) {
      io.emit(`chat_admin_reply_${sessionId}`, adminMsg)
      io.emit('chat_admin_reply', { sessionId, message: adminMsg })
    }

    res.json({ message: adminMsg })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/chat/sessions  (admin)
router.get('/sessions', requireAuth, (req, res) => {
  const list = Array.from(sessions.values())
    .filter(s => s.tenantId === req.tenantId)
    .sort((a, b) => new Date(b.lastActivity || b.createdAt) - new Date(a.lastActivity || a.createdAt))
  res.json(list)
})

// GET /api/chat/:sessionId  (admin)
router.get('/:sessionId', requireAuth, (req, res) => {
  const key = `${req.tenantId}:${req.params.sessionId}`
  const session = sessions.get(key)
  if (!session) return res.status(404).json({ error: 'Not found' })
  session.unread = 0
  res.json(session)
})

// DELETE /api/chat/:sessionId  (admin)
router.delete('/:sessionId', requireAuth, (req, res) => {
  const key = `${req.tenantId}:${req.params.sessionId}`
  sessions.delete(key)
  res.status(204).end()
})

module.exports = router
