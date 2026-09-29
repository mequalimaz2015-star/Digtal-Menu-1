/**
 * Platform Support Chat — backend/routes/platformChat.js
 *
 * This is the PLATFORM-LEVEL chat (website visitor ↔ MEGA Digital Menu superadmin).
 * It is completely separate from the per-restaurant chat in routes/chat.js.
 *
 * - No resolveTenant middleware (visitors have no tenant)
 * - Sessions keyed by sessionId only (not tenantId:sessionId)
 * - Socket.io events are emitted to the 'superadmin-support' room
 * - Superadmin joins that room from SupportChatPanel.jsx
 */

const router = require('express').Router()
const { requireAuth, requireRole } = require('../middleware/auth')

// In-memory session store (keyed by sessionId)
const platformSessions = new Map()

function getOrCreate(sessionId, visitorName = '', visitorEmail = '') {
  if (!platformSessions.has(sessionId)) {
    platformSessions.set(sessionId, {
      id: sessionId,
      visitorName: visitorName || 'Website Visitor',
      visitorEmail: visitorEmail || '',
      messages: [],
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      unread: 0,
      status: 'open', // 'open' | 'resolved'
    })
  }
  const s = platformSessions.get(sessionId)
  if (visitorName  && !s.visitorName)  s.visitorName  = visitorName
  if (visitorEmail && !s.visitorEmail) s.visitorEmail = visitorEmail
  return s
}

// Smart keyword bot for platform-level enquiries (pricing, demo, registration, etc.)
function getPlatformBotReply(text) {
  const t = text.toLowerCase().trim()

  if (/^(hi|hello|hey|hiya|good|selam|salam|ሰላም)/i.test(t))
    return `👋 Hello! Welcome to **MEGA Digital Menu** support!\n\nI'm here to help. I can answer questions about:\n• 💰 Pricing & plans\n• 🚀 Getting started\n• 📱 Features\n• 🍽️ Restaurant registration\n• 📞 How to contact our team\n\nOr a real team member will reply shortly. What can I help you with?`

  if (/price|cost|how much|plan|subscription|birr|etb|free|trial/i.test(t))
    return `💰 **Our Pricing Plans:**\n\n🆓 **Free Trial** — 0 ETB for 14 days\n• 20 menu items, 5 tables, 2 staff\n\n⭐ **Basic** — 1,500 ETB/month\n• 50 items, 15 tables, 5 staff, full reports\n\n🚀 **Pro + Delivery** — 3,500 ETB/month\n• Unlimited items, 50 tables, delivery & rider\n\nAll plans include QR ordering & live order tracking. Start with the free trial — no credit card required!`

  if (/register|sign up|start|how.*begin|create.*account|get started/i.test(t))
    return `🚀 **Getting Started is Easy!**\n\n1. Click **Sign Up Free** on the website\n2. Enter your restaurant name & contact info\n3. Your menu URL is created instantly\n4. Add your menu items & print QR codes\n\nThe whole setup takes under 10 minutes! Need help? Our team can set it up for you — just ask.`

  if (/feature|what.*do|capability|kitchen|kds|qr|delivery|takeaway|report/i.test(t))
    return `✨ **MEGA Digital Menu Features:**\n\n📱 QR Code Ordering (no app needed)\n🍽️ Digital Menu with images & Amharic\n👨‍🍳 Kitchen Display System (KDS)\n📦 Delivery & Takeaway with rider tracking\n📊 Reports & Analytics\n💬 Live Chat with customers\n⭐ Reviews & Ratings\n🌐 Multi-restaurant support\n\nWhich feature would you like to know more about?`

  if (/demo|see.*it.*work|show me|try/i.test(t))
    return `🎬 **Request a Demo**\n\nWe'd love to show you MEGA in action! You can:\n\n• 🆓 Start a **free 14-day trial** right now at the sign-up page\n• 📞 Call us at **+251 911 000 000**\n• 📧 Email **support@megadigitalmenu.com**\n\nOr leave your contact info here and our team will reach out within a few hours.`

  if (/contact|phone|call|email|reach|support|help|team/i.test(t))
    return `📞 **Contact MEGA Support:**\n\n📧 Email: support@megadigitalmenu.com\n📱 Phone: +251 911 000 000\n📍 Location: Bole Road, Addis Ababa\n🕐 Hours: Mon–Fri, 9:00 AM – 6:00 PM EAT\n\nYou can also keep chatting here and a team member will reply!`

  if (/amharic|language|english|translation/i.test(t))
    return `🇪🇹 **Language Support**\n\nYes! MEGA Digital Menu supports both **English and Amharic** for:\n• Menu item names and descriptions\n• Customer-facing pages\n• Staff notifications\n\nPerfect for Ethiopian restaurants serving both local and international guests.`

  if (/payment|chapa|telebirr|cash|pay/i.test(t))
    return `💳 **Payment Methods Supported:**\n\n• 💵 Cash on delivery / at table\n• 📱 **Telebirr** (Ethiopia's top mobile money)\n• 🏦 **Chapa** (online payment gateway)\n\nCustomers can pay however they prefer. All transactions are logged in your reports.`

  return `🤔 Thanks for reaching out! A member of our team will reply to your message shortly.\n\nIf it's urgent, you can also:\n📞 Call us: **+251 911 000 000**\n📧 Email: **support@megadigitalmenu.com**`
}

// ── POST /api/platform-chat ────────────────────────────────────────────────────
// Public — visitor sends a message (from LandingPage chat widget or contact form)
router.post('/', (req, res) => {
  try {
    const { sessionId, message, visitorName, visitorEmail } = req.body
    if (!sessionId || !message?.trim()) {
      return res.status(400).json({ error: 'sessionId and message are required' })
    }

    const session = getOrCreate(sessionId, visitorName, visitorEmail)

    const visitorMsg = {
      role: 'visitor',
      text: message.trim(),
      ts: new Date().toISOString(),
      id: `${Date.now()}-v`,
    }
    session.messages.push(visitorMsg)
    session.unread++
    session.lastActivity = new Date().toISOString()

    // Auto bot reply
    const botText = getPlatformBotReply(message)
    const botMsg = {
      role: 'bot',
      text: botText,
      ts: new Date().toISOString(),
      id: `${Date.now()}-b`,
    }
    session.messages.push(botMsg)

    // Notify superadmin panel via dedicated socket room
    const io = req.app.get('io')
    if (io) {
      io.to('superadmin-support').emit('platform_new_message', {
        sessionId,
        visitorName:  session.visitorName,
        visitorEmail: session.visitorEmail,
        message:      visitorMsg,
        unread:       session.unread,
      })
    }

    res.json({ message: botMsg, sessionId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/platform-chat/:sessionId/reply ──────────────────────────────────
// Superadmin replies to a visitor session
router.post('/:sessionId/reply', requireAuth, (req, res) => {
  try {
    const { sessionId } = req.params
    const { message } = req.body
    const adminUser = req.user

    // Allow super_admin only
    if (adminUser?.role !== 'super_admin') {
      return res.status(403).json({ error: 'Super admin only' })
    }

    if (!platformSessions.has(sessionId)) {
      return res.status(404).json({ error: 'Session not found' })
    }
    const session = platformSessions.get(sessionId)

    const adminMsg = {
      role: 'admin',
      text: message.trim(),
      ts: new Date().toISOString(),
      id: `${Date.now()}-a`,
      adminName: adminUser?.name || 'MEGA Support',
    }
    session.messages.push(adminMsg)
    session.lastActivity = new Date().toISOString()

    const io = req.app.get('io')
    if (io) {
      // Notify the visitor's widget directly by session ID channel
      io.emit(`platform_reply_${sessionId}`, adminMsg)
      // Also notify superadmin panel (for live update in message list)
      io.to('superadmin-support').emit('platform_admin_sent', { sessionId, message: adminMsg })
    }

    res.json({ message: adminMsg })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/platform-chat/sessions ──────────────────────────────────────────
// Superadmin: list all open visitor sessions
router.get('/sessions', requireAuth, (req, res) => {
  if (req.user?.role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' })
  const list = Array.from(platformSessions.values())
    .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity))
  res.json(list)
})

// ── GET /api/platform-chat/:sessionId ────────────────────────────────────────
// Superadmin: get full message history for one session
router.get('/:sessionId', requireAuth, (req, res) => {
  if (req.user?.role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' })
  const session = platformSessions.get(req.params.sessionId)
  if (!session) return res.status(404).json({ error: 'Not found' })
  session.unread = 0
  res.json(session)
})

// ── PATCH /api/platform-chat/:sessionId/resolve ───────────────────────────────
router.patch('/:sessionId/resolve', requireAuth, (req, res) => {
  if (req.user?.role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' })
  const session = platformSessions.get(req.params.sessionId)
  if (!session) return res.status(404).json({ error: 'Not found' })
  session.status = 'resolved'
  res.json({ ok: true })
})

// ── DELETE /api/platform-chat/:sessionId ─────────────────────────────────────
router.delete('/:sessionId', requireAuth, (req, res) => {
  if (req.user?.role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' })
  platformSessions.delete(req.params.sessionId)
  res.status(204).end()
})

module.exports = router
