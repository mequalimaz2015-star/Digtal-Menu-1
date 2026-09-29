import { useState, useRef, useEffect } from 'react'
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
function Field({ label, icon, error, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
        {icon && <span>{icon}</span>} {label}
      </label>
      {children}
      {error && <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1"><span>⚠️</span>{error}</p>}
    </div>
  )
}

const inputCls = 'w-full px-4 py-3.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all text-sm'

export default function TenantRegistration() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)   // 1=details, 2=otp, 3=success

  // Step 1 fields
  const [form, setForm] = useState({
    restaurant_name: '', slug: '', admin_name: '',
    email: '', phone: '', password: '', tin_number: '', address: '',
  })
  const [showPass, setShowPass] = useState(false)
  const [errors, setErrors]     = useState({})
  const [loading, setLoading]   = useState(false)

  // Step 2 OTP
  const [otp, setOtp]               = useState(['', '', '', '', '', ''])
  const [otpError, setOtpError]     = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [devCode, setDevCode]       = useState(null) // shown when SMTP not configured
  const otpRefs = useRef([])

  // Step 3 success
  const [successData, setSuccessData] = useState(null)

  // ── Auto-generate slug from restaurant name ────────────────────────────────
  const handleNameChange = (val) => {
    const autoSlug = val.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    setForm(p => ({ ...p, restaurant_name: val, slug: autoSlug }))
  }

  // ── Countdown timer for resend ─────────────────────────────────────────────
  useEffect(() => {
    if (resendTimer <= 0) return
    const t = setInterval(() => setResendTimer(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [resendTimer])

  // ── Validate step 1 ────────────────────────────────────────────────────────
  const validateStep1 = () => {
    const e = {}
    if (!form.restaurant_name.trim()) e.restaurant_name = 'Restaurant name is required'
    if (!form.slug.trim()) e.slug = 'URL slug is required'
    if (!form.admin_name.trim()) e.admin_name = 'Owner name is required'
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email required'
    if (!form.password || form.password.length < 6) e.password = 'Password must be at least 6 characters'
    setErrors(e)
    return Object.keys(e).length === 0
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
        // Auto-fill the OTP boxes so user doesn't have to type it manually
        setOtp(res.data.devCode.split(''))
      }
      setStep(2)
      setResendTimer(60)
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to send verification email'
      setErrors({ email: msg })
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
      // Verify OTP first
      await client.post('/auth/verify-otp', { email: form.email, code })

      // OTP valid → complete registration
      const res = await client.post('/tenants/register', form)

      // Clear any stale session before storing new one
      Object.keys(localStorage).filter(k => k.startsWith('menu-store-')).forEach(k => localStorage.removeItem(k))
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('admin-user', JSON.stringify(res.data.user))
      localStorage.setItem('tenant_slug', res.data.tenant.slug)

      setSuccessData({ tenant: res.data.tenant, user: res.data.user })
      setStep(3)
    } catch (err) {
      setOtpError(err.response?.data?.error || 'Verification failed. Please try again.')
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
                        className={inputCls} placeholder="e.g. Addis Bistro" />
                    </Field>

                    <Field label="Your Public URL" icon="🔗" error={errors.slug}>
                      <div className="flex">
                        <span className="px-3.5 py-3.5 bg-slate-700/60 border border-r-0 border-slate-700 rounded-l-xl text-xs text-slate-400 font-mono whitespace-nowrap flex items-center">
                          /r/
                        </span>
                        <input type="text" required value={form.slug}
                          onChange={e => setForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                          className={`${inputCls} rounded-l-none`} placeholder="addis-bistro" />
                      </div>
                      {form.slug && <p className="text-[11px] text-slate-500 mt-1 ml-1">URL: <span className="text-amber-400">/r/{form.slug}/menu</span></p>}
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Owner Name" icon="👤" error={errors.admin_name}>
                        <input type="text" required value={form.admin_name}
                          onChange={e => setForm(p => ({ ...p, admin_name: e.target.value }))}
                          className={inputCls} placeholder="Abebe Bikila" />
                      </Field>
                      <Field label="Phone" icon="📱">
                        <input type="text" value={form.phone}
                          onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                          className={inputCls} placeholder="+251 911 000 000" />
                      </Field>
                    </div>

                    <Field label="Email Address" icon="✉️" error={errors.email}>
                      <input type="email" required value={form.email}
                        onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                        className={inputCls} placeholder="owner@restaurant.com" />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="TIN Number" icon="🪪">
                        <input type="text" value={form.tin_number}
                          onChange={e => setForm(p => ({ ...p, tin_number: e.target.value }))}
                          className={inputCls} placeholder="0012345678" />
                      </Field>
                      <Field label="Location" icon="📍">
                        <input type="text" value={form.address}
                          onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                          className={inputCls} placeholder="Bole Road, Addis Ababa" />
                      </Field>
                    </div>

                    <Field label="Password" icon="🔒" error={errors.password}>
                      <div className="relative">
                        <input type={showPass ? 'text' : 'password'} required value={form.password}
                          onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                          className={`${inputCls} pr-12`} placeholder="Min. 6 characters" />
                        <button type="button" onClick={() => setShowPass(s => !s)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors text-lg">
                          {showPass ? '🙈' : '👁️'}
                        </button>
                      </div>
                    </Field>

                    <button type="submit" disabled={loading}
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

                  {/* Fallback: show OTP in UI when SMTP is not configured on server */}
                  {devCode && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                      className="mb-5 p-4 bg-amber-500/10 border border-amber-500/40 rounded-xl">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl flex-shrink-0">⚠️</span>
                        <div className="flex-1">
                          <p className="text-amber-400 text-xs font-bold uppercase tracking-wide mb-1">Email delivery unavailable</p>
                          <p className="text-slate-300 text-xs leading-relaxed mb-3">
                            The email server is not configured yet so the code couldn't be sent to your inbox.
                            Use the code below to continue — it works exactly the same.
                          </p>
                          <div className="bg-slate-950 border border-amber-500/50 rounded-lg px-4 py-3 text-center">
                            <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-1">Your verification code</p>
                            <p className="text-amber-400 text-2xl font-black font-mono tracking-[0.3em]">{devCode}</p>
                            <p className="text-slate-500 text-[10px] mt-1">Already filled in for you ↓</p>
                          </div>
                        </div>
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
