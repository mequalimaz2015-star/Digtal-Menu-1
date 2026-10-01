import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import client from '../../api/client'

// ── Step indicator ─────────────────────────────────────────────────────────────
function StepDot({ n, label, active, done }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm transition-all duration-300
        ${done  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
        : active ? 'bg-gradient-to-br from-amber-400 to-orange-600 text-slate-950 shadow-lg shadow-amber-500/40'
        :          'bg-slate-800 text-slate-500 border border-slate-700'}`}>
        {done ? '✓' : n}
      </div>
      <span className={`text-[10px] font-bold tracking-wide hidden sm:block ${active ? 'text-amber-400' : done ? 'text-emerald-400' : 'text-slate-600'}`}>
        {label}
      </span>
    </div>
  )
}

function StepLine({ done }) {
  return (
    <div className="flex-1 h-0.5 mx-2 mt-[-18px] sm:mt-[-22px] rounded-full transition-all duration-500
      bg-slate-800 overflow-hidden">
      <div className={`h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700 ${done ? 'w-full' : 'w-0'}`} />
    </div>
  )
}

// ── Input component ────────────────────────────────────────────────────────────
function Field({ label, icon, error, hint, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
        {icon && <span>{icon}</span>} {label}
      </label>
      {children}
      {error && <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1"><span>⚠️</span>{error}</p>}
      {!error && hint && <p className="text-slate-500 text-xs mt-1.5 flex items-center gap-1">{hint}</p>}
    </div>
  )
}

const inputCls = (hasError, isOk) =>
  `w-full px-4 py-3.5 bg-slate-800/80 border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition-all text-sm ${
    hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
      : isOk
        ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/30'
        : 'border-slate-700 focus:border-amber-500 focus:ring-amber-500/30'
  }`

export default function TenantRegistration() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)   // 1=details, 2=otp, 3=success

  // Step 1 fields
  const [form, setForm] = useState({
    restaurant_name: '', slug: '', admin_name: '',
    email: '', phone: '', password: '', tin_number: '', address: '',
  })
  const [showPass, setShowPass]   = useState(false)
  const [errors, setErrors]       = useState({})
  const [touched, setTouched]     = useState({})
  const [loading, setLoading]     = useState(false)

  // Slug availability state
  const [slugStatus, setSlugStatus] = useState(null) // null | 'checking' | 'available' | 'taken' | 'error'
  const slugDebounceRef = useRef(null)

  // Password strength
  const passwordStrength = (() => {
    const p = form.password
    if (!p) return { score: 0, label: '', color: '' }
    let score = 0
    if (p.length >= 6)  score++
    if (p.length >= 10) score++
    if (/[A-Z]/.test(p)) score++
    if (/[0-9]/.test(p)) score++
    if (/[^A-Za-z0-9]/.test(p)) score++
    const levels = [
      { label: 'Too short', color: 'bg-red-500' },
      { label: 'Weak',      color: 'bg-red-400' },
      { label: 'Fair',      color: 'bg-amber-400' },
      { label: 'Good',      color: 'bg-amber-500' },
      { label: 'Strong',    color: 'bg-emerald-500' },
      { label: 'Very strong', color: 'bg-emerald-400' },
    ]
    return { score, ...levels[Math.min(score, levels.length - 1)] }
  })()

  // Step 2 OTP
  const [otp, setOtp]               = useState(['', '', '', '', '', ''])
  const [otpError, setOtpError]     = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [devCode, setDevCode]       = useState(null)
  const otpRefs = useRef([])

  // Step 3 success
  const [successData, setSuccessData] = useState(null)

  // ── Auto-generate slug from restaurant name ────────────────────────────────
  const handleNameChange = (val) => {
    const autoSlug = val.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    setForm(p => ({ ...p, restaurant_name: val, slug: autoSlug }))
    checkSlugAvailability(autoSlug)
    if (touched.restaurant_name) validateField('restaurant_name', val)
  }

  // ── Real-time slug availability check (debounced 500 ms) ──────────────────
  const checkSlugAvailability = useCallback((slug) => {
    clearTimeout(slugDebounceRef.current)
    const clean = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    if (!clean || clean.length < 3) { setSlugStatus(null); return }
    setSlugStatus('checking')
    slugDebounceRef.current = setTimeout(async () => {
      try {
        const res = await client.get(`/tenants/check-slug?slug=${encodeURIComponent(clean)}`)
        setSlugStatus(res.data.available ? 'available' : 'taken')
        if (!res.data.available) {
          setErrors(e => ({ ...e, slug: res.data.reason || 'This URL is already taken' }))
        } else {
          setErrors(e => { const n = { ...e }; delete n.slug; return n })
        }
      } catch {
        setSlugStatus(null)
      }
    }, 500)
  }, [])

  // ── Per-field validation ───────────────────────────────────────────────────
  const validateField = useCallback((name, value) => {
    let err = ''
    switch (name) {
      case 'restaurant_name':
        if (!value.trim()) err = 'Restaurant name is required'
        else if (value.trim().length < 2) err = 'Name must be at least 2 characters'
        break
      case 'slug':
        if (!value.trim()) err = 'URL slug is required'
        else if (value.length < 3) err = 'Slug must be at least 3 characters'
        else if (!/^[a-z0-9-]+$/.test(value)) err = 'Only lowercase letters, numbers, and hyphens allowed'
        break
      case 'admin_name':
        if (!value.trim()) err = 'Owner name is required'
        break
      case 'email':
        if (!value.trim()) err = 'Email address is required'
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) err = 'Enter a valid email address'
        break
      case 'phone':
        if (value && !/^[\d\s+\-()]{7,15}$/.test(value.replace(/\s/g, '')))
          err = 'Enter a valid phone number'
        break
      case 'tin_number':
        if (value && !/^\d{10}$/.test(value.replace(/\s/g, '')))
          err = 'TIN number must be exactly 10 digits'
        break
      case 'password':
        if (!value) err = 'Password is required'
        else if (value.length < 6) err = 'Password must be at least 6 characters'
        break
      default: break
    }
    setErrors(e => err ? { ...e, [name]: err } : (({ [name]: _, ...rest }) => rest)(e))
    return !err
  }, [])

  const handleBlur = (name) => {
    setTouched(t => ({ ...t, [name]: true }))
    validateField(name, form[name])
    // Trigger slug check on blur too
    if (name === 'slug') checkSlugAvailability(form.slug)
  }

  const handleChange = (name, value) => {
    setForm(p => ({ ...p, [name]: value }))
    if (touched[name]) validateField(name, value)
  }

  // ── Countdown timer for resend ─────────────────────────────────────────────
  useEffect(() => {
    if (resendTimer <= 0) return
    const t = setInterval(() => setResendTimer(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [resendTimer])

  // ── Validate all step 1 fields ─────────────────────────────────────────────
  const validateStep1 = () => {
    const fields = ['restaurant_name', 'slug', 'admin_name', 'email', 'phone', 'tin_number', 'password']
    // Mark all touched
    const allTouched = fields.reduce((acc, f) => ({ ...acc, [f]: true }), {})
    setTouched(t => ({ ...t, ...allTouched }))
    let valid = true
    fields.forEach(f => { if (!validateField(f, form[f])) valid = false })
    if (slugStatus === 'taken') {
      setErrors(e => ({ ...e, slug: 'This URL is already taken. Please choose a different one.' }))
      valid = false
    }
    if (slugStatus === 'checking') {
      setErrors(e => ({ ...e, slug: 'Please wait — checking URL availability…' }))
      valid = false
    }
    return valid
  }

  // ── Step 1 → send OTP ──────────────────────────────────────────────────────
  const handleSendOTP = async (e) => {
    e.preventDefault()
    if (!validateStep1()) return
    setLoading(true)
    try {
      const res = await client.post('/auth/send-otp', {
        email: form.email,
        restaurantName: form.restaurant_name,
      })
      if (res.data.devCode) {
        setDevCode(res.data.devCode)
        setOtp(res.data.devCode.split(''))
      } else {
        setDevCode(null)
      }
      setStep(2)
      setResendTimer(60)
    } catch (err) {
      const data = err.response?.data || {}
      const msg  = data.error || 'Failed to send verification email'
      const field = data.field || 'email'
      setErrors(e => ({ ...e, [field]: msg }))
    } finally {
      setLoading(false)
    }
  }

  // ── OTP input handling ─────────────────────────────────────────────────────
  const handleOtpChange = (i, val) => {
    if (!/^\d?$/.test(val)) return
    const newOtp = [...otp]
    newOtp[i] = val
    setOtp(newOtp)
    setOtpError('')
    if (val && i < 5) otpRefs.current[i + 1]?.focus()
  }

  const handleOtpKey = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus()
    if (e.key === 'ArrowLeft' && i > 0) otpRefs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < 5) otpRefs.current[i + 1]?.focus()
  }

  const handleOtpPaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) {
      setOtp(text.split(''))
      otpRefs.current[5]?.focus()
    }
  }

  // ── Step 2 → verify OTP + register ────────────────────────────────────────
  const handleVerify = async (e) => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length < 6) { setOtpError('Please enter all 6 digits'); return }
    setOtpLoading(true)
    setOtpError('')
    try {
      await client.post('/auth/verify-otp', { email: form.email, code })
      const res = await client.post('/tenants/register', form)

      Object.keys(localStorage).filter(k => k.startsWith('menu-store-')).forEach(k => localStorage.removeItem(k))
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('admin-user', JSON.stringify(res.data.user))
      localStorage.setItem('tenant_slug', res.data.tenant.slug)

      setSuccessData({ tenant: res.data.tenant, user: res.data.user })
      setStep(3)
    } catch (err) {
      const data = err.response?.data || {}
      const msg  = data.error || 'Verification failed. Please try again.'
      // If the error is about a duplicate field, go back to step 1 and show it there
      if (data.field && data.field !== 'otp') {
        setErrors(e => ({ ...e, [data.field]: msg }))
        setStep(1)
      } else {
        setOtpError(msg)
      }
    } finally {
      setOtpLoading(false)
    }
  }

  // ── Resend OTP ─────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendTimer > 0) return
    setOtpError('')
    setOtp(['', '', '', '', '', ''])
    try {
      const res = await client.post('/auth/send-otp', { email: form.email, restaurantName: form.restaurant_name })
      if (res.data.devCode) {
        setDevCode(res.data.devCode)
        setOtp(res.data.devCode.split(''))
      } else {
        setDevCode(null)
        setOtp(['', '', '', '', '', ''])
      }
      setResendTimer(60)
    } catch (err) {
      setOtpError(err.response?.data?.error || 'Failed to resend code')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden">

      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-600/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/3 rounded-full blur-3xl" />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-slate-800/50">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/mega-logo.png" alt="MEGA" className="w-9 h-9 rounded-full object-cover ring-2 ring-amber-500/30" />
          <span className="font-black text-white text-sm hidden sm:block">MEGA <span className="text-amber-400">Digital Menu</span></span>
        </Link>
        <Link to="/admin/login" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
          Already registered? <span className="text-amber-400 font-bold">Sign In</span>
        </Link>
      </nav>

      <div className="relative z-10 flex-1 flex items-center justify-center py-10 px-4">
        <div className="w-full max-w-lg">

          {/* Step indicators */}
          <div className="flex items-center justify-center mb-8 px-4">
            <StepDot n={1} label="Your Details" active={step === 1} done={step > 1} />
            <StepLine done={step > 1} />
            <StepDot n={2} label="Verify Email"  active={step === 2} done={step > 2} />
            <StepLine done={step > 2} />
            <StepDot n={3} label="All Set!"      active={step === 3} done={false} />
          </div>

          <AnimatePresence mode="wait">

            {/* ── STEP 1: Restaurant details ── */}
            {step === 1 && (
              <motion.div key="step1"
                initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3 }}
              >
                <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-7 shadow-2xl">
                  {/* Header */}
                  <div className="text-center mb-7">
                    <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-xl shadow-amber-500/30">
                      🍽️
                    </div>
                    <h1 className="text-2xl font-black text-white">Launch Your Digital Menu</h1>
                    <p className="text-slate-400 text-sm mt-1.5">
                      Start your <span className="text-amber-400 font-bold">14-day free trial</span> — no credit card required
                    </p>
                  </div>

                  <form onSubmit={handleSendOTP} className="space-y-4">

                    <Field label="Restaurant Name" icon="🏪" error={errors.restaurant_name}>
                      <input type="text" required value={form.restaurant_name}
                        onChange={e => handleNameChange(e.target.value)}
                        onBlur={() => handleBlur('restaurant_name')}
                        className={inputCls(errors.restaurant_name, touched.restaurant_name && !errors.restaurant_name && form.restaurant_name)}
                        placeholder="e.g. Addis Bistro" />
                    </Field>

                    <Field label="Your Public URL" icon="🔗" error={errors.slug}
                      hint={slugStatus === 'available' ? '✅ URL is available!' : slugStatus === 'checking' ? '⏳ Checking availability…' : ''}>
                      <div className="flex">
                        <span className="px-3.5 py-3.5 bg-slate-700/60 border border-r-0 border-slate-700 rounded-l-xl text-xs text-slate-400 font-mono whitespace-nowrap flex items-center">
                          /r/
                        </span>
                        <div className="relative flex-1">
                          <input type="text" required value={form.slug}
                            onChange={e => {
                              const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
                              handleChange('slug', val)
                              checkSlugAvailability(val)
                            }}
                            onBlur={() => handleBlur('slug')}
                            className={`${inputCls(errors.slug, slugStatus === 'available')} rounded-l-none pr-10`}
                            placeholder="addis-bistro" />
                          {/* Status icon */}
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base pointer-events-none">
                            {slugStatus === 'checking'  && <span className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin inline-block" />}
                            {slugStatus === 'available' && <span className="text-emerald-400">✓</span>}
                            {slugStatus === 'taken'     && <span className="text-red-400">✗</span>}
                          </span>
                        </div>
                      </div>
                      {form.slug && (
                        <p className="text-[11px] text-slate-500 mt-1 ml-1">
                          URL: <span className={slugStatus === 'available' ? 'text-emerald-400' : slugStatus === 'taken' ? 'text-red-400' : 'text-amber-400'}>
                            /r/{form.slug}/menu
                          </span>
                        </p>
                      )}
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Owner Name" icon="👤" error={errors.admin_name}>
                        <input type="text" required value={form.admin_name}
                          onChange={e => handleChange('admin_name', e.target.value)}
                          onBlur={() => handleBlur('admin_name')}
                          className={inputCls(errors.admin_name, touched.admin_name && !errors.admin_name && form.admin_name)}
                          placeholder="Abebe Bikila" />
                      </Field>
                      <Field label="Phone" icon="📱" error={errors.phone}>
                        <input type="text" value={form.phone}
                          onChange={e => handleChange('phone', e.target.value)}
                          onBlur={() => handleBlur('phone')}
                          className={inputCls(errors.phone, touched.phone && !errors.phone && form.phone)}
                          placeholder="+251 911 000 000" />
                      </Field>
                    </div>

                    <Field label="Email Address" icon="✉️" error={errors.email}>
                      <input type="email" required value={form.email}
                        onChange={e => handleChange('email', e.target.value)}
                        onBlur={() => handleBlur('email')}
                        className={inputCls(errors.email, touched.email && !errors.email && form.email)}
                        placeholder="owner@restaurant.com" />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="TIN Number" icon="🪪" error={errors.tin_number}
                        hint={!errors.tin_number && form.tin_number && /^\d{10}$/.test(form.tin_number) ? '✅ Valid TIN' : !errors.tin_number && !form.tin_number ? 'Optional — 10 digits' : ''}>
                        <input type="text" value={form.tin_number}
                          onChange={e => handleChange('tin_number', e.target.value.replace(/\D/g, '').slice(0, 10))}
                          onBlur={() => handleBlur('tin_number')}
                          className={inputCls(errors.tin_number, !errors.tin_number && form.tin_number && /^\d{10}$/.test(form.tin_number))}
                          placeholder="0012345678"
                          maxLength={10}
                          inputMode="numeric" />
                      </Field>
                      <Field label="Location" icon="📍">
                        <input type="text" value={form.address}
                          onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                          className={inputCls(false, false)}
                          placeholder="Bole Road, Addis Ababa" />
                      </Field>
                    </div>

                    <Field label="Password" icon="🔒" error={errors.password}>
                      <div className="relative">
                        <input type={showPass ? 'text' : 'password'} required value={form.password}
                          onChange={e => handleChange('password', e.target.value)}
                          onBlur={() => handleBlur('password')}
                          className={`${inputCls(errors.password, touched.password && !errors.password && form.password)} pr-12`}
                          placeholder="Min. 6 characters" />
                        <button type="button" onClick={() => setShowPass(s => !s)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors text-lg">
                          {showPass ? '🙈' : '👁️'}
                        </button>
                      </div>
                      {/* Password strength bar */}
                      {form.password && (
                        <div className="mt-2">
                          <div className="flex gap-1 mb-1">
                            {[1,2,3,4,5].map(i => (
                              <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= passwordStrength.score ? passwordStrength.color : 'bg-slate-700'}`} />
                            ))}
                          </div>
                          <p className={`text-[11px] ${passwordStrength.score <= 1 ? 'text-red-400' : passwordStrength.score <= 2 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {passwordStrength.label}
                          </p>
                        </div>
                      )}
                    </Field>

                    <button type="submit" disabled={loading || slugStatus === 'checking' || slugStatus === 'taken'}
                      className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 text-slate-950 font-black text-base rounded-2xl transition-all shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 mt-2">
                      {loading
                        ? <><span className="w-5 h-5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" /> Sending verification code…</>
                        : <>Continue — Verify Email ✉️</>
                      }
                    </button>
                  </form>

                  <div className="mt-5 text-center text-xs text-slate-500">
                    Already have an account?{' '}
                    <Link to="/admin/login" className="text-amber-400 hover:text-amber-300 font-bold transition-colors">Sign in here</Link>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 2: Email OTP verification ── */}
            {step === 2 && (
              <motion.div key="step2"
                initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3 }}
              >
                <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-7 shadow-2xl">
                  <div className="text-center mb-7">
                    <motion.div
                      initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                      className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-4 shadow-xl shadow-blue-500/30">
                      ✉️
                    </motion.div>
                    <h2 className="text-2xl font-black text-white">Check Your Email</h2>
                    <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                      We sent a 6-digit code to<br />
                      <span className="text-amber-400 font-bold">{form.email}</span>
                    </p>
                  </div>

                  {/* Info box — only shown when email failed (devCode set) */}
                  {devCode ? (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                      className="mb-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl flex-shrink-0">⚠️</span>
                        <div className="flex-1">
                          <p className="text-red-400 text-xs font-bold uppercase tracking-wide mb-1">Email could not be delivered</p>
                          <p className="text-slate-300 text-xs leading-relaxed mb-3">
                            We couldn't send the email to your inbox. Use this code instead — it works exactly the same.
                          </p>
                          <div className="bg-slate-950 border border-red-500/40 rounded-lg px-4 py-3 text-center">
                            <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-1">Your verification code</p>
                            <p className="text-red-400 text-2xl font-black font-mono tracking-[0.3em]">{devCode}</p>
                            <p className="text-slate-500 text-[10px] mt-1">Already filled in for you ↓</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                      className="mb-5 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
                      <span className="text-xl flex-shrink-0">📬</span>
                      <div>
                        <p className="text-emerald-400 text-xs font-bold mb-0.5">Email sent successfully!</p>
                        <p className="text-slate-400 text-xs leading-relaxed">
                          Check your inbox and <span className="text-amber-400 font-semibold">Spam / Promotions</span> folder. The code expires in <span className="text-amber-400 font-bold">10 minutes</span>.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  <form onSubmit={handleVerify} className="space-y-6">
                    {/* 6-digit OTP boxes */}
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-3 text-center">
                        Enter verification code
                      </label>
                      <div className="flex gap-2.5 justify-center" onPaste={handleOtpPaste}>
                        {otp.map((digit, i) => (
                          <input
                            key={i}
                            ref={el => otpRefs.current[i] = el}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={e => handleOtpChange(i, e.target.value)}
                            onKeyDown={e => handleOtpKey(i, e)}
                            className={`w-12 h-14 text-center text-xl font-black rounded-xl border-2 bg-slate-800 text-white transition-all outline-none
                              ${digit ? 'border-amber-500 shadow-md shadow-amber-500/20' : 'border-slate-700'}
                              focus:border-amber-400 focus:shadow-lg focus:shadow-amber-500/20`}
                          />
                        ))}
                      </div>
                      {otpError && (
                        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          className="text-red-400 text-xs mt-3 text-center flex items-center justify-center gap-1.5">
                          <span>⚠️</span>{otpError}
                        </motion.p>
                      )}
                    </div>

                    <button type="submit" disabled={otpLoading || otp.join('').length < 6}
                      className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-40 text-slate-950 font-black text-base rounded-2xl transition-all shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2">
                      {otpLoading
                        ? <><span className="w-5 h-5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" /> Creating your restaurant…</>
                        : <>🚀 Verify &amp; Launch My Restaurant</>
                      }
                    </button>
                  </form>

                  {/* Resend + back */}
                  <div className="mt-5 flex flex-col items-center gap-3">
                    <p className="text-slate-500 text-xs">
                      Didn't receive the code?{' '}
                      {resendTimer > 0
                        ? <span className="text-slate-400">Resend in <span className="text-amber-400 font-bold tabular-nums">{resendTimer}s</span></span>
                        : <button onClick={handleResend} className="text-amber-400 hover:text-amber-300 font-bold transition-colors">Resend code</button>
                      }
                    </p>
                    <button onClick={() => { setStep(1); setOtp(['','','','','','']); setOtpError('') }}
                      className="text-slate-500 hover:text-slate-300 text-xs transition-colors flex items-center gap-1">
                      ← Back to edit details
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: Success ── */}
            {step === 3 && successData && (
              <motion.div key="step3"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, type: 'spring', stiffness: 150 }}
              >
                <div className="bg-slate-900/80 backdrop-blur-xl border border-emerald-500/20 rounded-3xl p-7 shadow-2xl text-center">
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                    className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-3xl flex items-center justify-center text-5xl mx-auto mb-5 shadow-2xl shadow-emerald-500/30">
                    🎉
                  </motion.div>

                  <h2 className="text-2xl font-black text-white mb-1">{successData.tenant.name} is Live!</h2>
                  <p className="text-slate-400 text-sm mb-6">Your digital menu is ready and your free trial has started.</p>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {[
                      { icon: '✅', label: 'Email Verified', val: 'Done' },
                      { icon: '🆓', label: 'Free Trial',     val: '14 Days' },
                      { icon: '🔗', label: 'Menu URL',       val: 'Active' },
                    ].map(s => (
                      <div key={s.label} className="bg-slate-800/60 rounded-2xl p-3 border border-slate-700/50">
                        <div className="text-2xl mb-1">{s.icon}</div>
                        <div className="text-white font-black text-sm">{s.val}</div>
                        <div className="text-slate-500 text-[10px] mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* URL pill */}
                  <div className="mb-6 inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 border border-amber-500/30 rounded-xl font-mono text-amber-400 text-sm">
                    🔗 /r/{successData.tenant.slug}/menu
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <a href={`/r/${successData.tenant.slug}/menu`} target="_blank" rel="noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-2xl text-sm font-bold transition-all">
                      👁️ View Menu
                    </a>
                    <button onClick={() => navigate('/admin')}
                      className="flex items-center justify-center gap-2 px-4 py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-black rounded-2xl text-sm transition-all shadow-lg shadow-amber-500/20">
                      Admin Panel →
                    </button>
                  </div>

                  <p className="text-slate-600 text-xs mt-5">
                    📧 A welcome email has been sent to <span className="text-slate-400">{form.email}</span>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
