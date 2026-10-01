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
    <div className="min-h-screen flex overflow-hidden relative">

      {/* ════════════════════════════════════════════════════════════════
          GLOBAL BACKGROUND
      ════════════════════════════════════════════════════════════════ */}
      <div className="absolute inset-0 bg-[#0f0500]" />
      {/* Warm ambient glow */}
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
          LEFT PANEL — Features
      ════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col w-[340px] xl:w-[400px] flex-shrink-0 relative overflow-hidden">

        {/* Panel background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1c0800] via-[#2a0e00] to-[#1c0800]" />
        <div className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 20% 30%, rgba(234,88,12,0.18) 0%, transparent 70%)',
          }}
        />

        {/* Animated diagonal stripe */}
        <motion.div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #f97316 0, #f97316 1px, transparent 0, transparent 50%)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Vertical orange edge line */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-orange-500/40 to-transparent" />

        {/* Moving orb */}
        <motion.div
          className="absolute w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.15) 0%, transparent 70%)', top: '-60px', left: '-60px' }}
          animate={{ x: [0, 40, 0], y: [0, 60, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 70%)', bottom: '60px', right: '-30px' }}
          animate={{ x: [0, -30, 0], y: [0, -40, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />

        <div className="relative z-10 flex flex-col h-full px-8 py-10">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3 mb-12"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-600 rounded-xl flex items-center justify-center text-2xl shadow-lg shadow-orange-500/40 flex-shrink-0">
              🍽️
            </div>
            <div>
              <p className="text-white font-black text-xl leading-none">MEGA</p>
              <p className="text-amber-400 text-xs font-bold tracking-widest uppercase">Digital Menu</p>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-10"
          >
            <h2 className="text-3xl xl:text-4xl font-black text-white leading-tight">
              Run your<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                restaurant
              </span><br />
              smarter.
            </h2>
            <p className="text-white/40 text-sm mt-3 leading-relaxed">
              Everything you need to manage orders, staff, and your menu — all in one place.
            </p>
          </motion.div>

          {/* Feature list */}
          <div className="space-y-4 flex-1">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
                className="flex items-start gap-3 group"
              >
                <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/20 flex items-center justify-center text-base flex-shrink-0 group-hover:bg-orange-500/25 group-hover:border-orange-500/40 transition-all">
                  {f.icon}
                </div>
                <div>
                  <p className="text-white text-sm font-bold">{f.title}</p>
                  <p className="text-white/35 text-xs leading-snug">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Bottom stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="mt-10 grid grid-cols-3 gap-3"
          >
            {[
              { value: '2k+', label: 'Restaurants' },
              { value: '99%', label: 'Uptime' },
              { value: '24/7', label: 'Support' },
            ].map((s, i) => (
              <div key={i} className="text-center p-3 rounded-xl bg-white/5 border border-white/8">
                <p className="text-amber-400 font-black text-lg leading-none">{s.value}</p>
                <p className="text-white/30 text-[10px] mt-1 font-medium">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          CENTER — Login card
      ════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 relative">
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

      {/* ════════════════════════════════════════════════════════════════
          RIGHT PANEL — Animated menu preview cards
      ════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col w-[340px] xl:w-[400px] flex-shrink-0 relative overflow-hidden">

        {/* Panel background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1c0800] via-[#2a0e00] to-[#1c0800]" />
        <div className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 80% 60%, rgba(220,38,38,0.15) 0%, transparent 70%)',
          }}
        />

        {/* Animated diagonal stripe */}
        <motion.div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: 'repeating-linear-gradient(-45deg, #f97316 0, #f97316 1px, transparent 0, transparent 50%)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Left edge line */}
        <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-orange-500/40 to-transparent" />

        {/* Moving orbs */}
        <motion.div
          className="absolute w-72 h-72 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 70%)', top: '-80px', right: '-80px' }}
          animate={{ x: [0, -40, 0], y: [0, 50, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(251,146,60,0.12) 0%, transparent 70%)', bottom: '40px', left: '-30px' }}
          animate={{ x: [0, 30, 0], y: [0, -50, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        />

        <div className="relative z-10 flex flex-col h-full px-8 py-10">
          {/* Section header */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <p className="text-amber-400 text-xs font-bold tracking-widest uppercase mb-2">Live Menu Preview</p>
            <h3 className="text-white font-black text-2xl">Your dishes,<br />beautifully displayed</h3>
            <p className="text-white/30 text-xs mt-2">Customers see exactly this on their phones</p>
          </motion.div>

          {/* Dish cards — staggered scroll animation */}
          <div className="flex-1 space-y-3 overflow-hidden">
            {DISHES.map((dish, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.12 }}
              >
                <motion.div
                  animate={{ y: [0, i % 2 === 0 ? -4 : 4, 0] }}
                  transition={{ duration: 4 + i * 0.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
                  whileHover={{ scale: 1.02, x: -4 }}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/8 hover:border-orange-500/30 hover:bg-white/8 transition-all cursor-default group"
                >
                  {/* Emoji icon with gradient bg */}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${dish.color} flex items-center justify-center text-2xl flex-shrink-0 shadow-lg group-hover:shadow-orange-500/30 transition-shadow`}>
                    {dish.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">{dish.name}</p>
                    <p className="text-white/35 text-xs">{dish.cat}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className="text-amber-400 font-black text-sm">{dish.price}</span>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>

          {/* Bottom CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0 }}
            className="mt-8 p-4 rounded-2xl bg-gradient-to-r from-orange-500/15 to-red-500/10 border border-orange-500/20"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-xl flex-shrink-0 shadow-md shadow-orange-500/40">
                📲
              </div>
              <div>
                <p className="text-white font-bold text-sm">Scan & Order</p>
                <p className="text-white/40 text-xs">No app download required</p>
              </div>
              <motion.div
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                className="ml-auto text-amber-400 text-lg"
              >
                →
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

    </div>
  )
}
