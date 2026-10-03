const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: require('path').join(__dirname, '.env') })

// Prevent uncaught errors from crashing the container
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception (keeping server alive):', err.message)
})
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled rejection (keeping server alive):', reason?.message || reason)
})

// Initialize Database connection & auto-migration
require('./db')

const app = express()
app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '10mb' }))        // allow large base64 images
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Routes
app.use('/api/auth',        require('./routes/auth'))
app.use('/api/superadmin', require('./routes/superadmin'))
app.use('/api/tenants',    require('./routes/tenants'))
app.use('/api/delivery',   require('./routes/delivery'))
app.use('/api/restaurant', require('./routes/restaurant'))
app.use('/api/categories', require('./routes/categories'))
app.use('/api/menu-items', require('./routes/menuItems'))
app.use('/api/ai-menu-import', require('./routes/aiMenuImport'))
app.use('/api/modifiers',  require('./routes/modifiers'))
app.use('/api/tables',     require('./routes/tables'))
app.use('/api/orders',     require('./routes/orders'))
app.use('/api/users',      require('./routes/users'))
app.use('/api/waiter-calls', require('./routes/waiterCalls'))
app.use('/api/reviews',    require('./routes/reviews'))
app.use('/api/chat',       require('./routes/chat'))
app.use('/api/platform-chat', require('./routes/platformChat'))

app.get('/health', (req, res) => res.json({ status: 'healthy' }))
app.get('/api/status', (req, res) => res.json({ message: 'ABC Restaurant API', status: 'running' }))

// ── Email config diagnostic (no auth needed — remove after debugging) ─────────
app.get('/api/email-test', async (req, res) => {
  const { sendEmail } = require('./emailService')
  const to = req.query.to || 'test@example.com'
  const config = {
    BREVO_API_KEY:  process.env.BREVO_API_KEY ? `SET (${process.env.BREVO_API_KEY.slice(0,16)}...)` : 'NOT SET ⚠️',
    BREVO_SENDER:   process.env.BREVO_SENDER  || 'NOT SET',
    SMTP_USER:      process.env.SMTP_USER     || 'NOT SET ⚠️',
    SMTP_PASS:      process.env.SMTP_PASS     ? 'SET' : 'NOT SET ⚠️',
    targetEmail:    to,
  }
  try {
    const result = await sendEmail({
      to,
      subject: 'MEGA — Email Test',
      html: '<p>This is a test email from MEGA Digital Menu. Email is working! ✅</p>',
      text: 'This is a test email from MEGA Digital Menu. Email is working!',
    })
    res.json({ config, result })
  } catch (err) {
    res.json({ config, error: err.message })
  }
})

// ── Public IP endpoint — used to whitelist server IP in Brevo SMTP ────────────
app.get('/api/server-ip', async (req, res) => {
  const os = require('os')
  const interfaces = os.networkInterfaces()
  let localIp = null
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIp = iface.address
        break
      }
    }
  }
  // Try to get public IP from external service
  try {
    const https = require('https')
    const publicIp = await new Promise((resolve, reject) => {
      https.get('https://api.ipify.org?format=json', (r) => {
        let data = ''
        r.on('data', d => data += d)
        r.on('end', () => { try { resolve(JSON.parse(data).ip) } catch { resolve(null) } })
      }).on('error', reject)
    })
    return res.json({ publicIp, localIp, note: 'Add publicIp to Brevo Authorized IPs to enable email sending' })
  } catch (_) {
    res.json({ publicIp: null, localIp, note: 'Could not fetch public IP' })
  }
})

app.get('/api/network-info', (req, res) => {
  const os = require('os')
  const interfaces = os.networkInterfaces()
  let localIp = 'localhost'
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIp = iface.address
        break
      }
    }
  }
  res.json({ localIp, port: process.env.PORT || 8000, frontendPort: 3000 })
})

// Serve frontend static files — look in common build locations
const candidatePaths = [
  path.join(__dirname, '..', 'frontend', 'dist'),
  path.join(__dirname, 'frontend', 'dist'),
  path.join(process.cwd(), 'frontend', 'dist'),
  path.join(process.cwd(), 'dist'),
]

const frontendDist = candidatePaths.find(p => {
  try { return fs.existsSync(path.join(p, 'index.html')) } catch (_) { return false }
})

if (frontendDist) {
  console.log(`✅ Serving frontend from: ${frontendDist}`)
  app.use(express.static(frontendDist))
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API route not found' })
    }
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
} else {
  console.warn('ℹ️ Running in API-only mode (frontend dist not found)')
  app.get('/', (req, res) => res.json({ message: 'ABC Restaurant API', status: 'running' }))
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API route not found' })
    }
    res.status(404).json({ error: 'Frontend not built. Please run npm run build.' })
  })
}

const http = require('http')
const { Server } = require('socket.io')

const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: '*' }
})

app.set('io', io)

io.on('connection', (socket) => {
  console.log('⚡ Client connected to socket:', socket.id)

  // ── Room join: admin/restaurant staff joins their tenant room ─────────────
  // Client sends: socket.emit('join_tenant', { tenantId: 3 })
  socket.on('join_tenant', ({ tenantId } = {}) => {
    if (!tenantId) return
    socket.join(`tenant-${tenantId}`)
    console.log(`🏠 Socket ${socket.id} joined tenant room: tenant-${tenantId}`)
  })

  // ── Room join: customer joins a room scoped to tenant + their session ID ──
  // Client sends: socket.emit('join_customer', { tenantId: 3, sessionId: 'abc123' })
  socket.on('join_customer', ({ tenantId, sessionId } = {}) => {
    if (!tenantId || !sessionId) return
    const room = `customer-${tenantId}-${sessionId}`
    socket.join(room)
    console.log(`👤 Socket ${socket.id} joined customer room: ${room}`)
  })

  // ── Room join: superadmin support panel joins the platform support room ──────
  // Client sends: socket.emit('join_superadmin_support')
  socket.on('join_superadmin_support', () => {
    socket.join('superadmin-support')
    console.log(`🛡️ Socket ${socket.id} joined superadmin-support room`)
  })

  // ── Room leave ─────────────────────────────────────────────────────────────
  socket.on('leave_tenant', ({ tenantId } = {}) => {
    if (tenantId) socket.leave(`tenant-${tenantId}`)
  })

  socket.on('disconnect', () => {
    console.log('🔌 Socket disconnected:', socket.id)
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`)
})
