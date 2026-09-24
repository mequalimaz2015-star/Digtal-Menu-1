const router = require('express').Router()
const auth   = require('../middleware/auth')
const { query } = require('../db')

const sessions = new Map()

function getOrCreate(sessionId, tableNumber = '') {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      id: sessionId,
      tableNumber,
      messages: [],
      createdAt: new Date().toISOString(),
      unread: 0,
    })
  }
  return sessions.get(sessionId)
}

async function getAIReply(userText, sessionId, tableNumber) {
  const text = userText.toLowerCase().trim()
  let menuItems = []
  let restaurantData = {}

  try {
    const [menuRes, restRes] = await Promise.all([
      query(`SELECT name, price, description, category_id, is_available, is_popular, is_spicy, is_vegetarian FROM menu_items WHERE is_available=true ORDER BY is_popular DESC, name LIMIT 20`),
      query(`SELECT name, address, phone, working_hours, wifi_password, vat_rate, service_charge_rate FROM restaurant LIMIT 1`),
    ])
    menuItems      = menuRes.rows  || []
    restaurantData = restRes.rows[0] || {}
  } catch (_) {}

  const restaurant = restaurantData.name || 'ABC Restaurant'
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

  if (/reserv|book|table|seat/i.test(text))
    return `🪑 **Table Reservations**\n\nCall us: **${restaurantData.phone || '+251 91 859 2028'}**\nOr scan the QR code at any table to order directly!`

  if (/spicy|spice|hot|veg|vegetarian|halal|allerg/i.test(text)) {
    const spicy = menuItems.filter(i => i.is_spicy).slice(0, 4).map(i => i.name).join(', ')
    const veg   = menuItems.filter(i => i.is_vegetarian).slice(0, 4).map(i => i.name).join(', ')
    return `🌶️ **Spicy dishes:** ${spicy || 'Ask our staff'}\n\n🥬 **Vegetarian dishes:** ${veg || 'We have several options — ask your waiter!'}`
  }

  if (/complaint|problem|issue|wrong|bad|unhappy|not good|terrible|awful/i.test(text))
    return `😔 We're really sorry!\n\n👨‍💼 **A manager will be with you shortly.**\n\n📞 Call us: ${restaurantData.phone || '+251 91 859 2028'}`

  if (/thank|great|awesome|love|delicious|amazing|wonderful|excellent|best/i.test(text))
    return `😊 Thank you so much! That means the world to us! 🙏\n\n⭐ Would you like to leave us a review?`

  if (/waiter|staff|help|assist|someone|human|person|agent|talk to/i.test(text))
    return `🛎️ **Calling a Waiter**\n\nI'm notifying our staff right now!\n\n• Tap the **🔔 bell icon** at the top of the menu page`

  if (/bill|pay|payment|cash|card|checkout/i.test(text))
    return `💳 **Payment**\n\nWe accept cash at the table.\nTap the **🔔 bell** → select "Request the bill"\n\nAll prices include ${vatPct}% VAT and ${svcPct}% service charge.`

  if (/bye|goodbye|see you|later|thanks bye|cya/i.test(text))
    return `👋 Goodbye! Thank you for visiting **${restaurant}**! Have a wonderful day! 🌟`

  return `🤔 I'm not quite sure, but I'm connecting you with our team!\n\n🔔 You can also call a waiter or reach us at: ${restaurantData.phone || '+251 91 859 2028'}`
}

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    const { sessionId, tableNumber, message, customerName } = req.body
    if (!sessionId || !message?.trim()) return res.status(400).json({ error: 'sessionId and message required' })

    const session = getOrCreate(sessionId, tableNumber || '')
    if (customerName && !session.customerName) session.customerName = customerName
    if (tableNumber  && !session.tableNumber)  session.tableNumber  = tableNumber

    const customerMsg = { role: 'customer', text: message.trim(), ts: new Date().toISOString(), id: `${Date.now()}-c` }
    session.messages.push(customerMsg)
    session.unread++
    session.lastActivity = new Date().toISOString()

    const aiText = await getAIReply(message, sessionId, tableNumber)
    const botMsg = { role: 'bot', text: aiText, ts: new Date().toISOString(), id: `${Date.now()}-b` }
    session.messages.push(botMsg)

    const io = req.app.get('io')
    if (io) {
      io.emit('chat_new_message', {
        sessionId,
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
router.post('/:sessionId/reply', auth, async (req, res) => {
  try {
    const { sessionId } = req.params
    const { message } = req.body
    const adminUser = req.user

    if (!sessions.has(sessionId)) return res.status(404).json({ error: 'Session not found' })
    const session = sessions.get(sessionId)

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
router.get('/sessions', auth, (req, res) => {
  const list = Array.from(sessions.values())
    .sort((a, b) => new Date(b.lastActivity || b.createdAt) - new Date(a.lastActivity || a.createdAt))
  res.json(list)
})

// GET /api/chat/:sessionId  (admin)
router.get('/:sessionId', auth, (req, res) => {
  const session = sessions.get(req.params.sessionId)
  if (!session) return res.status(404).json({ error: 'Not found' })
  session.unread = 0
  res.json(session)
})

// DELETE /api/chat/:sessionId  (admin)
router.delete('/:sessionId', auth, (req, res) => {
  sessions.delete(req.params.sessionId)
  res.status(204).end()
})

module.exports = router
