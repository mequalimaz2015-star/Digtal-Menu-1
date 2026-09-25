import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { FiMail, FiLock, FiEye, FiEyeOff, FiChevronDown } from 'react-icons/fi'
import toast from 'react-hot-toast'

// Role → destination route
const ROLE_REDIRECT = {
  admin:   '/admin',
  manager: '/admin',
  barista: '/admin',
  kitchen: '/admin/kitchen',
  waiter:  '/admin/orders',
}

// All staff accounts for quick-fill
const ACCOUNTS = [
  { role: 'Admin',    email: 'admin@abc.com',   password: 'admin123',    icon: '👑', cls: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400' },
  { role: 'Manager',  email: 'manager@abc.com',  password: 'manager123',  icon: '💼', cls: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' },
  { role: 'Barista',  email: 'barista@abc.com',  password: 'barista123',  icon: '☕', cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' },
  { role: 'Waiter 1', email: 'waiter1@abc.com',  password: 'waiter123',   icon: '🛎️', cls: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400' },
  { role: 'Waiter 2', email: 'waiter2@abc.com',  password: 'waiter2pass', icon: '🛎️', cls: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400' },
  { role: 'Kitchen',  email: 'kitchen@abc.com',  password: 'kitchen123',  icon: '👨‍🍳', cls: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' },
]

export default function AdminLogin() {
  const navigate = useNavigate()
  const { register, handleSubmit, setValue } = useForm()
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [showHints, setShowHints] = useState(false)

  const fillAccount = (acc) => {
    setValue('email', acc.email)
    setValue('password', acc.password)
    setShowHints(false)
  }

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const apiBase = `${window.location.protocol}//${window.location.hostname}:8000/api`

      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: data.password }),
      })

      if (res.ok) {
        const result = await res.json()
        localStorage.setItem('token', result.access_token)
        localStorage.setItem('admin-user', JSON.stringify(result.user))
        // Critical: store tenant_slug so every axios API call sends the right X-Tenant-Slug header
        if (result.user?.tenant_slug) {
          localStorage.setItem('tenant_slug', result.user.tenant_slug)
        }

        const role = result.user?.role || 'admin'
        const dest = ROLE_REDIRECT[role] || '/admin'

        toast.success(`Welcome, ${result.user?.name}! Redirecting to ${role} view...`)
        navigate(dest, { replace: true })
      } else {
        const err = await res.json()
        toast.error(err.error || 'Invalid credentials')
      }
    } catch {
      // Offline fallback
      if (data.email === 'admin@abc.com' && data.password === 'admin123') {
        localStorage.setItem('token', 'demo-admin-token')
        toast('⚠️ API offline — demo mode', { icon: '⚠️' })
        navigate('/admin', { replace: true })
      } else {
        toast.error('Could not connect. Check that the backend is running.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-600 via-red-600 to-orange-800 flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-8 w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-7">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg shadow-orange-300">
            🍽️
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">Staff Login</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">ABC Restaurant · Staff Portal</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email */}
          <div className="relative">
            <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              {...register('email', { required: true })}
              type="email"
              placeholder="Staff email"
              autoComplete="username"
              className="w-full pl-10 pr-4 py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              {...register('password', { required: true })}
              type={showPass ? 'text' : 'password'}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full pl-10 pr-12 py-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              {showPass ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </div>

          {/* Quick-fill accounts */}
          <div>
            <button type="button" onClick={() => setShowHints(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:border-orange-300 transition-colors">
              <span className="font-semibold">👥 Quick fill — choose account</span>
              <motion.div animate={{ rotate: showHints ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <FiChevronDown size={16} />
              </motion.div>
            </button>

            <AnimatePresence>
              {showHints && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 space-y-1.5 p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                    {ACCOUNTS.map((acc, i) => (
                      <motion.button
                        key={i}
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={() => fillAccount(acc)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-transparent hover:border-orange-200 dark:hover:border-orange-800 transition-all hover:scale-[1.01] ${acc.cls}`}
                      >
                        <span className="text-xl flex-shrink-0">{acc.icon}</span>
                        <div className="flex-1 text-left">
                          <p className="font-black text-sm">{acc.role}</p>
                          <p className="text-xs opacity-70 font-mono">{acc.email}</p>
                        </div>
                        <span className="text-xs font-mono bg-white/60 dark:bg-black/20 px-2 py-1 rounded-lg border border-white/30">
                          {acc.password}
                        </span>
                      </motion.button>
                    ))}
                    <p className="text-[10px] text-gray-400 text-center pt-1">
                      Tap any account to auto-fill credentials
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Role redirect info */}
          <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-gray-500 dark:text-gray-400">
            {[
              { icon: '👑', label: 'Admin',   dest: 'Full Access',    cls: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400' },
              { icon: '💼', label: 'Manager', dest: 'No Users/Settings', cls: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' },
              { icon: '☕', label: 'Barista', dest: 'Full (no Users)', cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' },
              { icon: '🛎️', label: 'Waiter',  dest: 'Orders + Reviews', cls: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400' },
              { icon: '👨‍🍳', label: 'Kitchen', dest: 'Kitchen Display', cls: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' },
            ].map((r, i) => (
              <div key={i} className={`rounded-xl p-2 ${r.cls}`}>
                <div className="text-base mb-0.5">{r.icon}</div>
                <div className="font-bold text-[10px]">{r.label}</div>
                <div className="opacity-70 text-[9px] leading-tight">{r.dest}</div>
              </div>
            ))}
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading}
            className="w-full bg-orange-500 text-white font-black py-4 rounded-2xl hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200 dark:shadow-none disabled:opacity-60 flex items-center justify-center gap-2 text-base">
            {loading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full" />
            ) : '🔐 Sign In'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
