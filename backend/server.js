const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: require('path').join(__dirname, '.env') })

// Initialize Database connection & auto-migration
require('./db')

const app = express()
app.use(cors({ origin: '*' }))
app.use(express.json())

// Routes
app.use('/api/auth',        require('./routes/auth'))
app.use('/api/superadmin',  require('./routes/superadmin'))
app.use('/api/tenants',     require('./routes/tenants'))
app.use('/api/delivery',    require('./routes/delivery'))
app.use('/api/restaurant',  require('./routes/restaurant'))
app.use('/api/categories',  require('./routes/categories'))
app.use('/api/menu-items',  require('./routes/menuItems'))
app.use('/api/modifiers',   require('./routes/modifiers'))
app.use('/api/tables',      require('./routes/tables'))
app.use('/api/orders',      require('./routes/orders'))
app.use('/api/users',       require('./routes/users'))
app.use('/api/waiter-calls',require('./routes/waiterCalls'))
app.use('/api/reviews',     require('./routes/reviews'))
app.use('/api/chat',        require('./routes/chat'))

app.get('/health', (req, res) => res.json({ status: 'healthy' }))
app.get('/api/status', (req, res) => res.json({ message: 'ABC Restaurant API', status: 'running' }))
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

// ── Serve frontend & handle all SPA routes (/superadmin, /admin, /r/:slug) ──
// Try multiple candidate paths so it works in Docker (AltCloud), Render, and local
const candidatePaths = [
  path.join(__dirname, 'frontend', 'dist'),       // Docker: /app/frontend/dist  (WORKDIR=/app)
  path.join(__dirname, '..', 'frontend', 'dist'), // Local: backend/../frontend/dist
  path.join(process.cwd(), 'frontend', 'dist'),
  path.join(process.cwd(), 'dist'),
  '/app/frontend/dist',
  '/frontend/dist'
]

const frontendDist = candidatePaths.find(p => {
  try { return fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html')) }
  catch (_) { return false }
})

if (frontendDist) {
  console.log(`✅ Serving frontend from: ${frontendDist}`)
  app.use(express.static(frontendDist))
  // SPA fallback — must catch ALL non-API routes so /superadmin, /admin etc. work
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API route not found' })
    }
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
} else {
  console.warn('ℹ️ Frontend dist not found — running in API-only mode')
  app.get('/', (req, res) => res.json({ message: 'ABC Restaurant API', status: 'running' }))
}

const http = require('http')
const { Server } = require('socket.io')

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

app.set('io', io)

io.on('connection', socket => {
  console.log('⚡ Client connected:', socket.id)
})

const PORT = process.env.PORT || 3000
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`)
})
