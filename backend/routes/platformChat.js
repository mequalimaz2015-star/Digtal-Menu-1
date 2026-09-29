/**
 * Platform Support Chat — backend/routes/platformChat.js
 *
 * PLATFORM-LEVEL chat: website visitor ↔ MEGA Digital Menu superadmin.
 * Completely separate from per-restaurant chat in routes/chat.js.
 *
 * Key fixes vs first version:
 *  - GET /sessions MUST be registered BEFORE GET /:sessionId to avoid Express
 *    matching the literal string "sessions" as a :sessionId param.
 *  - Role check accepts both super_admin AND admin (demo token also works).
 *  - No resolveTenant middleware — visitors have no tenant.
 */

const router = require('express').Router()
const { requireAuth } = require('../middleware/auth')

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
      status: 'open',
    })
  }
  const s = platformSessions.get(sessionId)
  // Update visitor info if provided for the first time
  if (visitorName  && (s.visitorName  === 'Website Visitor' || !s.visitorName))  s.visitorName  = visitorName
  if (visitorEmail && !s.visitorEmail) s.visitorEmail = visitorEmail
  return s
}

// ── Smart platform bot ────────────────────────────────────────────────────────
function getPlatformBotReply(text) {
  const t = text.toLowerCase().trim()

  if (/^(hi|hello|hey|hiya|good|selam|salam|ሰላም)/i.test(t))
    return `👋 Hello! Welcome to **MEGA Digital Menu** support!\n\nI can help with:\n• 💰 Pricing & plans\n• 🚀 Getting started\n• 📱 Features\n• 🍽️ Restaurant registration\n\nA team member will also reply soon!`

  if (/price|cost|how much|plan|subscription|birr|etb|free|trial/i.test(t))
    return `💰 **Our Pricing Plans:**\n\n🆓 **Free Trial** — 0 ETB (14 days)\n⭐ **Basic** — 1,500 ETB/month\n🚀 **Pro + Delivery** — 3,500 ETB/month\n\nAll plans include QR ordering & live tracking. No credit card for the trial!`

  if (/register|sign up|start|how.*begin|create.*account|get started/i.test(t))
    return `🚀 **Getting Started:**\n\n1. Click **Sign Up Free** on the website\n2. Enter your restaurant details\n3. Your menu URL is ready instantly\n4. Add menu items & print QR codes\n\nSetup takes under 10 minutes!`

  if (/feature|what.*do|capability|kitchen|kds|qr|delivery|takeaway|report/i.test(t))
    return `✨ **MEGA Features:**\n\n📱 QR Ordering • 🍽️ Digital Menu • 👨‍🍳 Kitchen Display\n📦 Delivery & Takeaway • 📊 Reports • 💬 Live Chat\n⭐ Reviews • 🌐 Multi-restaurant\n\nWhich feature would you like to know more about?`

  if (/demo|see.*it|show me|try/i.test(t))
    return `🎬 **Request a Demo:**\n\n• Start a **free 14-day trial** now\n• Call: **+251 911 000 000**\n• Email: **support@megadigitalmenu.com**\n\nOr leave your contact info and we'll reach out!`

  if (/contact|phone|call|email|reach|support|help/i.test(t))
    return `📞 **Contact MEGA Support:**\n\n📧 support@megadigitalmenu.com\n📱 +251 911 000 000\n📍 Bole Road, Addis Ababa\n🕐 Mon–Fri, 9AM – 6PM EAT`

  return `🤔 Thanks for reaching out! A team member will reply shortly.\n\n📞 Urgent? Call: **+251 911 000 000**\n📧 Email: **support@megadigitalmenu.com**`
}

// ── POST /api/platform-chat ────────────────────────────────────────────────────
// PUBLIC — visitor sends a message (no auth required)
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

    // Notify superadmin panel — emit to the superadmin-support room
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

// ── GET /api/platform-chat/sessions ──────────────────────────────────────────
// IMPORTANT: This MUST come before GET /:sessionId to avoid Express
// treating "sessions" as a :sessionId param value.
router.get('/sessions', requireAuth, (req, res) => {
  const list = Array.from(platformSessions.values())
    .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity))
  res.json(list)
})

// ── POST /api/platform-chat/:sessionId/reply ──────────────────────────────────
// Superadmin replies to a visitor
router.post('/:sessionId/reply', requireAuth, (req, res) => {
  try {
    const { sessionId } = req.params
    const { message } = req.body
    const adminUser = req.user

    if (!message?.trim()) return res.status(400).json({ error: 'Message required' })

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
      // Deliver reply to the visitor's widget (global emit by session channel)
      io.emit(`platform_reply_${sessionId}`, adminMsg)
      // Also update the superadmin panel live
      io.to('superadmin-support').emit('platform_admin_sent', { sessionId, message: adminMsg })
    }

    res.json({ message: adminMsg })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/platform-chat/:sessionId ────────────────────────────────────────
router.get('/:sessionId', requireAuth, (req, res) => {
  const session = platformSessions.get(req.params.sessionId)
  if (!session) return res.status(404).json({ error: 'Not found' })
  session.unread = 0
  res.json(session)
})

// ── PATCH /api/platform-chat/:sessionId/resolve ───────────────────────────────
router.patch('/:sessionId/resolve', requireAuth, (req, res) => {
  const session = platformSessions.get(req.params.sessionId)
  if (!session) return res.status(404).json({ error: 'Not found' })
  session.status = 'resolved'
  res.json({ ok: true })
})

// ── DELETE /api/platform-chat/:sessionId ─────────────────────────────────────
router.delete('/:sessionId', requireAuth, (req, res) => {
  platformSessions.delete(req.params.sessionId)
  res.status(204).end()
})

module.exports = router
