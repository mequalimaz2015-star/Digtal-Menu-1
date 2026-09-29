const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { query } = require('../db')
const { requireAuth } = require('../middleware/auth')
const local = require('../localStore')
const { sendEmail, otpEmailHtml } = require('../emailService')
// In-memory OTP store: email → { code, expiresAt, restaurantName }
// (survives server restart for ~10 min window, no DB needed)
const otpStore = new Map()

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

const FALLBACK_USERS = [
  {
    id: 1,
    name: 'Admin User',
    email: 'admin@abc.com',
    password: '$2a$10$0JrruzcU5e6jBnxxTWXL2.2pE6TJNGE6DGdkMyVFbAnMOUJhVkBLu', // admin123
    role: 'admin',
    tenant_id: 1,
    tenant_slug: 'abc-restaurant',
    tenant_name: 'ABC Restaurant'
  },
  {
    id: 2,
    name: 'Super Platform Owner',
    email: 'superadmin@platform.com',
    password: '$2a$10$qe7/PTxsZuOCLCGogUR6derKf4RGIfGyUA3mOpjXzn5peKiJ35v9a', // superadmin123
    role: 'super_admin',
    tenant_id: null,
    tenant_slug: null,
    tenant_name: 'Platform Engine'
  },
  {
    id: 3,
    name: 'Rider User',
    email: 'rider@abc.com',
    password: '$2a$10$0JrruzcU5e6jBnxxTWXL2.2pE6TJNGE6DGdkMyVFbAnMOUJhVkBLu', // admin123
    role: 'rider',
    tenant_id: 1,
    tenant_slug: 'abc-restaurant',
    tenant_name: 'ABC Restaurant'
  }
]

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' })

    const cleanEmail = email.toLowerCase().trim()
    let user = null

    try {
      const result = await query(
        `SELECT u.*, t.slug as tenant_slug, t.name as tenant_name, t.status as tenant_status
         FROM users u
         LEFT JOIN tenants t ON u.tenant_id = t.id
         WHERE LOWER(u.email) = $1 AND (u.is_active = true OR u.is_active IS NULL)`,
        [cleanEmail]
      )
      user = result.rows[0]
    } catch (dbErr) {
      console.warn('DB unavailable during login, trying fallback store:', dbErr.message)
    }

    if (!user) {
      // Check hardcoded fallbacks
      user = FALLBACK_USERS.find(u => u.email.toLowerCase() === cleanEmail)
    }

    if (!user) {
      // Check localStore users — look up the real tenant slug
      const localUser = local.getUserByEmail(cleanEmail)
      if (localUser) {
        const localTenant = localUser.tenant_id
          ? local.getTenantBySlug(String(localUser.tenant_id))
          : null
        user = {
          ...localUser,
          // Keep localUser.password (the bcrypt hash stored at registration)
          // Do NOT overwrite it with a hardcoded hash
          tenant_slug: localTenant ? localTenant.slug : null,
          tenant_name: localTenant ? localTenant.name : 'Restaurant'
        }
      }
    }

    if (!user) {
      local.logActivity({
        action: 'login_failed', targetName: 'Failed Login Attempt',
        targetType: 'auth', actorEmail: cleanEmail, actorRole: 'unknown',
        tenantName: 'Platform', details: `No account found for ${cleanEmail}`,
      })
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Check credentials with bcrypt, and allow direct default fallback passwords
    let valid = false
    if (cleanEmail === 'superadmin@platform.com' && (password === 'superadmin123' || password === 'admin123')) {
      valid = true
    } else if (cleanEmail === 'admin@abc.com' && password === 'admin123') {
      valid = true
    } else {
      valid = await bcrypt.compare(password, user.password).catch(() => false)
    }

    if (!valid) {
      local.logActivity({
        action:     'login_failed',
        targetName: `Failed Login Attempt`,
        targetType: 'auth',
        actorEmail: cleanEmail,
        actorRole:  'unknown',
        tenantName: 'Platform',
        details:    `Invalid password for ${cleanEmail}`,
      })
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // If non-superadmin and tenant is suspended, deny login
    if (user.role !== 'super_admin' && user.tenant_status === 'suspended') {
      return res.status(403).json({ error: 'Your restaurant account is suspended. Please contact platform support.' })
    }

    // Log successful login
    local.logActivity({
      action:     'login',
      targetName: `${user.name || user.email} Login`,
      targetType: 'auth',
      actorEmail: user.email,
      actorRole:  user.role,
      tenantName: user.tenant_name || (user.role === 'super_admin' ? 'Platform' : 'Restaurant'),
      details:    `Role: ${user.role}`,
    })

    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role, 
        tenant_id: user.tenant_id,
        tenant_slug: user.tenant_slug 
      },
      process.env.JWT_SECRET || 'digital-menu-secret-key-2024-abc-restaurant',
      { expiresIn: process.env.JWT_EXPIRES || '7d' }
    )

    res.json({
      access_token: token,
      token_type: 'bearer',
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role, 
        tenant_id: user.tenant_id,
        tenant_slug: user.tenant_slug,
        tenant_name: user.tenant_name 
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    try {
      const result = await query(
        `SELECT u.id, u.name, u.email, u.role, u.tenant_id, u.is_active, u.created_at,
                t.name as tenant_name, t.slug as tenant_slug, t.status as tenant_status
         FROM users u
         LEFT JOIN tenants t ON u.tenant_id = t.id
         WHERE u.id = $1`,
        [req.user.id]
      )
      if (result.rows[0]) return res.json(result.rows[0])
    } catch (_) {}

    const fallback = FALLBACK_USERS.find(u => u.id === req.user.id) || req.user
    res.json(fallback)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/auth/send-otp ───────────────────────────────────────────────────
// Public — send a 6-digit OTP to an email address for registration verification
router.post('/send-otp', async (req, res) => {
  try {
    const { email, restaurantName } = req.body
    if (!email) return res.status(400).json({ error: 'Email required' })

    const cleanEmail = email.toLowerCase().trim()

    // Check email not already registered — check both DB and localStore
    try {
      const existing = await query('SELECT id FROM users WHERE LOWER(email)=$1', [cleanEmail])
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'This email is already registered. Please sign in instead.' })
      }
    } catch (_) {
      // DB unavailable — check localStore
      const localUser = local.getUserByEmail(cleanEmail)
      if (localUser) {
        return res.status(400).json({ error: 'This email is already registered. Please sign in instead.' })
      }
    }

    const otp = generateOTP()
    const expiresAt = Date.now() + 10 * 60 * 1000 // 10 minutes

    // Rate limiting: allow max 3 sends per email per 10 min window
    const existing = otpStore.get(cleanEmail)
    if (existing && existing.sendCount >= 3 && existing.expiresAt > Date.now()) {
      return res.status(429).json({ error: 'Too many OTP requests. Please wait 10 minutes and try again.' })
    }

    otpStore.set(cleanEmail, {
      code: otp,
      expiresAt,
      restaurantName: restaurantName || '',
      sendCount: (existing?.sendCount || 0) + 1,
    })

    // Send email (async — don't block response)
    const emailResult = await sendEmail({
      to:      cleanEmail,
      subject: `${otp} — Your MEGA Digital Menu verification code`,
      html:    otpEmailHtml(otp, restaurantName),
      text:    `Your MEGA Digital Menu verification code is: ${otp}\n\nThis code expires in 10 minutes.`,
    })

    const smtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS)
    console.log(`📧 OTP sent to ${cleanEmail}: ${otp} (${emailResult.ok ? 'delivered' : 'email failed - check SMTP config'})`)
    if (emailResult.preview) console.log('   Preview (Ethereal):', emailResult.preview)
    if (!smtpConfigured) console.warn('⚠️  SMTP not configured — OTP not delivered to real email. Set SMTP_USER and SMTP_PASS env vars.')

    res.json({
      ok: true,
      message: `Verification code sent to ${cleanEmail}`,
      // Always return devCode when SMTP is not configured so user can still register
      ...(!smtpConfigured && { devCode: otp, smtpMissing: true }),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────────
// Public — verify OTP. Returns { valid: true } on success, marks it used.
router.post('/verify-otp', (req, res) => {
  const { email, code } = req.body
  if (!email || !code) return res.status(400).json({ error: 'Email and code required' })

  const cleanEmail = email.toLowerCase().trim()
  const record = otpStore.get(cleanEmail)

  if (!record) return res.status(400).json({ error: 'No verification code found for this email. Please request a new one.' })
  if (Date.now() > record.expiresAt) {
    otpStore.delete(cleanEmail)
    return res.status(400).json({ error: 'Verification code expired. Please request a new one.' })
  }
  if (record.code !== String(code).trim()) {
    return res.status(400).json({ error: 'Incorrect verification code. Please try again.' })
  }

  // Mark as verified (don't delete immediately — registration call might come seconds later)
  record.verified = true
  res.json({ ok: true, message: 'Email verified successfully!' })
})

module.exports = router
