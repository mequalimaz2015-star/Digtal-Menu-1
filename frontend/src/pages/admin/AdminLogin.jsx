import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi'
import toast from 'react-hot-toast'

const ROLE_REDIRECT = {
  admin:   '/admin',
  manager: '/admin',
  barista: '/admin',
  kitchen: '/admin/kitchen',
  waiter:  '/admin/orders',
}

// ── Left panel — feature highlights ──────────────────────────────────────────
const FEATURES = [
  { icon: '📊', title: 'Live Dashboard',    desc: 'Real-time orders & revenue at a glance' },
  { icon: '🤖', title: 'AI Menu Import',    desc: 'Scan a photo — AI builds your menu instantly' },
  { icon: '📱', title: 'QR Table Ordering', desc: 'Customers order from their phone, no app needed' },
  { icon: '🚀', title: 'Instant Updates',   desc: 'Menu changes go live across all devices in seconds' },
  { icon: '📦', title: 'Order Tracking',    desc: 'Kitchen display, status updates, delivery routes' },
]

// ── Right panel — animated food cards ────────────────────────────────────────
const DISHES = [
  { emoji: '🍕', name: 'Margherita',   price: 'ETB 320', cat: 'Pizza',     color: 'from-orange-500 to-red-600' },
  { emoji: '🥩', name: 'Tibs Firfir',  price: 'ETB 180', cat: 'Ethiopian', color: 'from-amber-600 to-orange-700' },
  { emoji: '🍔', name: 'Beef Burger',  price: 'ETB 280', cat: 'Burgers',   color: 'from-red-500 to-orange-600' },
  { emoji: '☕', name: 'Macchiato',    price: 'ETB  45', cat: 'Coffee',    color: 'from-amber-700 to-yellow-600' },
  { emoji: '🥗', name: 'Caesar Salad', price: 'ETB 160', cat: 'Salads',    color: 'from-green-600 to-teal-600' },
  { emoji: '🍰', name: 'Tiramisu',     price: 'ETB 120', cat: 'Desserts',  color: 'from-pink-500 to-rose-600' },
]

// ── Floating particle dots for the background ─────────────────────────────────
const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  x: `${Math.random() * 100}%`,
  y: `${Math.random() * 100}%`,
  size: Math.random() * 4 + 2,
  delay: Math.random() * 4,
  duration: Math.random() * 4 + 4,
}))

export default function AdminLogin() {
  const navigate = useNavigate()
  const { register, handleSubmit } = useForm()
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: data.email, password: data.password }),
      })
      if (res.ok) {
        const result = await res.json()
        Object.keys(localStorage)
          .filter(k => k.startsWith('menu-store-'))
          .forEach(k => localStorage.removeItem(k))
        localStorage.setItem('token', result.access_token)
        localStorage.setItem('admin-user', JSON.stringify(result.user))
        let slug = result.user?.tenant_slug
        if (!slug && result.access_token) {
          try {
            const p = result.access_token.split('.')
            const pl = JSON.parse(atob(p[1].replace(/-/g, '+').replace(/_/g, '/')))
            slug = pl.tenant_slug || null
          } catch (_) {}
        }
        if (slug) localStorage.setItem('tenant_slug', slug)
        else      localStorage.removeItem('tenant_slug')
        const role = result.user?.role || 'admin'
        toast.success(`Welcome, ${result.user?.name}!`)
        navigate(ROLE_REDIRECT[role] || '/admin', { replace: true })
      } else {
        const err = await res.json()
        toast.error(err.error || 'Invalid email or password')
      }
    } catch {
      if (data.email === 'admin@abc.com' && data.password === 'admin123') {
        localStorage.setItem('token', 'demo-admin-token')
        toast('⚠️ Offline — demo mode', { icon: '⚠️' })
        navigate('/admin', { replace: true })
      } else {
        toast.error('Could not connect to server.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center overflow-hidden relative">

      {/* ════════════════════════════════════════════════════════════════
          BACKGROUND
      ════════════════════════════════════════════════════════════════ */}
      <div className="absolute inset-0 bg-[#0f0500]" />
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 50%, #7c2d0a33 0%, transparent 70%)',
        }}
      />

      {/* Particle dots */}
      {PARTICLES.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-orange-400/20 pointer-events-none"
          style={{ left: p.x, top: p.y, width: p.size, height: p.size }}
          animate={{ y: [0, -30, 0], opacity: [0.1, 0.4, 0.1] }}
          transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
        />
      ))}

      {/* ════════════════════════════════════════════════════════════════
          CENTER — Login card
      ════════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 w-full flex items-center justify-center px-4 py-8">
        {/* Center glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(234,88,12,0.08) 0%, transparent 70%)' }}
        />

        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-sm"
        >
          {/* Card */}
          <div className="bg-white/[0.07] backdrop-blur-2xl border border-white/12 rounded-3xl shadow-2xl shadow-black/70 overflow-hidden">
            <div className="h-[3px] w-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500" />

            <div className="px-8 py-8">
              {/* Logo */}
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 220 }}
                  className="inline-flex w-[72px] h-[72px] bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl items-center justify-center text-4xl shadow-xl shadow-orange-500/50 mb-4"
                >
                  🍽️
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl font-black text-white"
                >
                  Welcome back
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  className="text-white/35 text-sm mt-1"
                >
                  Sign in to your admin account
                </motion.p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Email */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="relative group"
                >
                  <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25 group-focus-within:text-amber-400 transition-colors" size={16} />
                  <input
                    {...register('email', { required: true })}
                    type="email"
                    placeholder="Email address"
                    autoComplete="username"
                    className="w-full pl-11 pr-4 py-3.5 bg-white/6 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/25 transition-all text-sm"
                  />
                </motion.div>

                {/* Password */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="relative group"
                >
                  <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25 group-focus-within:text-amber-400 transition-colors" size={16} />
                  <input
                    {...register('password', { required: true })}
                    type={showPass ? 'text' : 'password'}
                    placeholder="Password"
                    autoComplete="current-password"
                    className="w-full pl-11 pr-12 py-3.5 bg-white/6 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/25 transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-amber-400 transition-colors"
                  >
                    {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </motion.div>

                {/* Sign in */}
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 text-slate-950 font-black text-[15px] rounded-2xl transition-all shadow-xl shadow-orange-500/35 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-slate-950/30 border-t-slate-950 rounded-full"
                    />
                  ) : <>🔐 Sign In</>}
                </motion.button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-white/20 text-xs">or</span>
                <div className="flex-1 h-px bg-white/8" />
              </div>

              {/* Sign up */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Link
                  to="/register-tenant"
                  className="block w-full py-3.5 border border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/8 text-amber-400 font-bold text-sm text-center rounded-2xl transition-all"
                >
                  ✨ Create a Restaurant Account
                </Link>
              </motion.div>

              <p className="text-white/15 text-[11px] text-center mt-5">
                © {new Date().getFullYear()} MEGA Digital Menu Platform
              </p>
            </div>
          </div>

          {/* Glow under card */}
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-2/3 h-10 bg-orange-500/20 blur-2xl rounded-full pointer-events-none" />
        </motion.div>
      </div>

    </div>
  )
}
