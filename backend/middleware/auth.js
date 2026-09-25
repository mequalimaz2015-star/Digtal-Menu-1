const jwt = require('jsonwebtoken')

function requireAuth(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ error: 'No token provided' })

  const token = auth.split(' ')[1]

  // Allow demo token for offline/testing fallback
  if (token === 'demo-admin-token') {
    req.user = { id: 1, email: 'admin@abc.com', role: 'admin', tenant_id: 1 }
    return next()
  }

  if (token === 'demo-superadmin-token') {
    req.user = { id: 2, email: 'superadmin@platform.com', role: 'super_admin', tenant_id: null }
    return next()
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'digital-menu-secret-key-2024-abc-restaurant')
    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    if (req.user.role === 'super_admin') {
      return next() // Super admin has global access
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' })
    }

    next()
  }
}

module.exports = {
  requireAuth,
  requireRole
}
