import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { io } from 'socket.io-client'

const NAV_LINKS = [
  { label: 'Home',     href: '#home' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing',  href: '#pricing' },
  { label: 'About Us', href: '#about' },
  { label: 'Contact',  href: '#contact' },
]

const FEATURES = [
  { icon: '📱', title: 'QR Code Ordering',    desc: 'Customers scan a QR code at their table and order directly from their phone — no app download needed.' },
  { icon: '🍽️', title: 'Digital Menu',        desc: 'Beautiful, image-rich menus with categories, modifiers, allergens and multilingual support (English & Amharic).' },
  { icon: '🔔', title: 'Real-Time Notifications', desc: 'Orders appear instantly on the admin dashboard and kitchen display the moment a customer submits.' },
  { icon: '👨‍🍳', title: 'Kitchen Display',    desc: 'Dedicated KDS screen shows live orders flowing from New → Preparing → Ready → Served.' },
  { icon: '📊', title: 'Reports & Analytics', desc: 'Daily revenue, top-selling items, and order history — all exportable to Excel and PDF.' },
  { icon: '🌐', title: 'Multi-Restaurant',    desc: 'Run multiple restaurants under one platform. Each gets its own admin, menu, and customer URL.' },
  { icon: '🛍️', title: 'Takeaway & Delivery', desc: 'Supports dine-in, takeaway with pickup numbers, and delivery with map-based address selection.' },
  { icon: '💬', title: 'Live Chat Support',   desc: 'Built-in chat between customers and restaurant staff — answer questions and upsell in real time.' },
  { icon: '⭐', title: 'Reviews & Ratings',   desc: 'Collect structured customer feedback after every meal to improve your service.' },
]

const PRICING = [
  {
    name: 'Free Trial',
    price: '0',
    period: '14 days',
    color: 'border-slate-700',
    badge: '',
    features: ['Up to 20 menu items', '5 tables', '2 staff accounts', 'QR code ordering', 'Basic reports'],
    cta: 'Start Free Trial',
    highlight: false,
  },
  {
    name: 'Basic',
    price: '1,500',
    period: 'ETB / month',
    color: 'border-amber-500',
    badge: 'Popular',
    features: ['Up to 50 menu items', '15 tables', '5 staff accounts', 'QR code ordering', 'Full reports & exports', 'Live chat support'],
    cta: 'Get Started',
    highlight: true,
  },
  {
    name: 'Pro + Delivery',
    price: '3,500',
    period: 'ETB / month',
    color: 'border-orange-500',
    badge: 'Best Value',
    features: ['Unlimited menu items', '50 tables', '20 staff accounts', 'Delivery & takeaway', 'Rider management', 'White-label branding', 'Priority support'],
    cta: 'Go Pro',
    highlight: false,
  },
]

const TESTIMONIALS = [
  { name: 'Yohannes T.',  role: 'Owner, Bole Café',         text: 'Orders went from handwritten slips to instant notifications. Our kitchen team loves the KDS screen.', stars: 5 },
  { name: 'Selam G.',     role: 'Manager, Addis Bistro',    text: 'We set up our full menu in under an hour. Customers scan the QR and order themselves — no more waiting.', stars: 5 },
  { name: 'Abebe M.',     role: 'Owner, Piazza Lounge',     text: 'The multilingual menu is perfect for our international guests. Reviews have helped us improve our menu.', stars: 5 },
]

// ── Platform Support Chat Widget ──────────────────────────────────────────────
const API_URL = import.meta.env.VITE_API_URL || '/api'

function getVisitorSessionId() {
  let sid = sessionStorage.getItem('visitor_support_session')
  if (!sid) {
    sid = `vsup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    sessionStorage.setItem('visitor_support_session', sid)
  }
  return sid
}

function SupportChatWidget() {
  const [open, setOpen]           = useState(false)
  const [messages, setMessages]   = useState([])
  const [input, setInput]         = useState('')
  const [sending, setSending]     = useState(false)
  const [visitorInfo, setVisitorInfo] = useState({ name: '', email: '', submitted: false })
  const [unread, setUnread]       = useState(0)
  const bottomRef                 = useRef(null)
  const socketRef                 = useRef(null)
  const sessionId                 = getVisitorSessionId()

  useEffect(() => {
    const socket = io('/', { transports: ['websocket', 'polling'] })
    socketRef.current = socket
    // Listen for superadmin replies addressed to this session
    socket.on(`platform_reply_${sessionId}`, (msg) => {
      setMessages(prev => [...prev, msg])
      if (!open) setUnread(n => n + 1)
    })
    return () => socket.disconnect()
  }, [sessionId, open])

  useEffect(() => {
    if (open) setUnread(0)
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const sendMessage = async (text, name = '', email = '') => {
    if (!text.trim()) return
    setSending(true)
    const visitorMsg = { role: 'visitor', text: text.trim(), ts: new Date().toISOString(), id: `v-${Date.now()}` }
    setMessages(prev => [...prev, visitorMsg])
    try {
      const res = await fetch(`${API_URL}/platform-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text, visitorName: name, visitorEmail: email }),
      })
      const data = await res.json()
      if (data.message) setMessages(prev => [...prev, data.message])
    } catch (_) {}
    setSending(false)
  }

  const handleInfoSubmit = (e) => {
    e.preventDefault()
    setVisitorInfo(v => ({ ...v, submitted: true }))
    sendMessage('Hello! I just started a chat.', visitorInfo.name, visitorInfo.email)
  }

  const handleSend = (e) => {
    e.preventDefault()
    if (!input.trim() || sending) return
    sendMessage(input, visitorInfo.name, visitorInfo.email)
    setInput('')
  }

  const renderText = (text) =>
    text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : part
    )

  return (
    <>
      {/* Floating bubble */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full shadow-2xl shadow-orange-500/40 flex items-center justify-center text-slate-950 text-2xl"
        aria-label="Open support chat"
      >
        {open ? '✕' : '💬'}
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-slate-950">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            style={{ maxHeight: '520px' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-600 flex-shrink-0">
              <img src="/mega-logo.png" alt="MEGA" className="w-8 h-8 rounded-full object-cover border-2 border-white/30" />
              <div className="flex-1 min-w-0">
                <p className="text-slate-950 font-black text-sm">MEGA Support</p>
                <p className="text-slate-900/70 text-[10px] font-medium">Typically replies in minutes</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-950/70 hover:text-slate-950">✕</button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 min-h-0">
              {/* Welcome */}
              {messages.length === 0 && !visitorInfo.submitted && (
                <div className="text-center py-4">
                  <div className="text-3xl mb-2">👋</div>
                  <p className="text-white font-bold text-sm">Hi there!</p>
                  <p className="text-slate-400 text-xs mt-1">Ask us anything about MEGA Digital Menu. We usually reply within minutes.</p>
                </div>
              )}

              {messages.map(msg => {
                const isAdmin = msg.role === 'admin'
                const isBot   = msg.role === 'bot'
                return (
                  <div key={msg.id} className={`flex ${isAdmin || isBot ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                      isAdmin ? 'bg-amber-500 text-slate-950 font-medium'
                      : isBot ? 'bg-slate-800 text-slate-200'
                      : 'bg-indigo-600 text-white'
                    }`}>
                      {isBot && <span className="text-[10px] text-slate-400 block mb-1">🤖 MEGA Bot</span>}
                      {isAdmin && <span className="text-[10px] text-slate-900/70 block mb-1">💼 {msg.adminName || 'MEGA Support'}</span>}
                      {renderText(msg.text)}
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Name/email gate or message input */}
            {!visitorInfo.submitted ? (
              <form onSubmit={handleInfoSubmit} className="px-4 py-3 border-t border-slate-800 space-y-2 flex-shrink-0">
                <p className="text-slate-400 text-xs font-semibold">Quick intro before we chat:</p>
                <input
                  required
                  placeholder="Your name"
                  value={visitorInfo.name}
                  onChange={e => setVisitorInfo(v => ({ ...v, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={visitorInfo.email}
                  onChange={e => setVisitorInfo(v => ({ ...v, email: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <button type="submit" className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition-colors">
                  Start Chat →
                </button>
              </form>
            ) : (
              <form onSubmit={handleSend} className="flex items-center gap-2 px-3 py-3 border-t border-slate-800 flex-shrink-0">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Type a message…"
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="w-9 h-9 flex-shrink-0 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 rounded-xl flex items-center justify-center text-slate-950 text-base transition-colors"
                >
                  ➤
                </button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

// ── Left panel feature callouts (from the mockup image) ──────────────────────
const LEFT_FEATURES = [
  { icon: '⚡', title: 'Quick & Easy Access',   desc: 'Scan the QR code and explore the menu instantly.' },
  { icon: '📱', title: 'Order Directly',         desc: 'Choose your favorite items and place your order.' },
  { icon: '🌿', title: 'Fresh & Delicious',      desc: 'Enjoy quality food and refreshing drinks.' },
  { icon: '❤️', title: 'Better Experience',      desc: 'Modern, simple and user-friendly.' },
]

// ── Hidden "About Digital Menu" animated overlay ──────────────────────────────
const ABOUT_STATS = [
  { val: '500+',    label: 'Restaurants',     icon: '🏪' },
  { val: '50,000+', label: 'Orders/Month',    icon: '🛒' },
  { val: '4.9★',    label: 'Avg Rating',      icon: '⭐' },
  { val: '3 min',   label: 'Setup Time',      icon: '⚡' },
]

const ABOUT_FEATURES_HIDDEN = [
  { icon: '🤖', title: 'AI-Powered Import',    desc: 'Upload a photo of your paper menu — our AI reads and creates your digital menu automatically.' },
  { icon: '🔄', title: 'Real-Time Sync',        desc: 'Menu updates appear for customers the instant you save. No refresh, no delay.' },
  { icon: '🌍', title: 'Multi-Language',        desc: 'Full English and Amharic support. Your menu speaks your customers\' language.' },
  { icon: '📊', title: 'Smart Analytics',       desc: 'See your top dishes, peak hours, and revenue trends at a glance.' },
  { icon: '🎯', title: 'Table-Level QR',        desc: 'Each table gets its own unique QR code. Orders route directly to the right ticket.' },
  { icon: '🚀', title: 'Instant Onboarding',    desc: 'From sign-up to live digital menu in under 3 minutes. No technical skills needed.' },
]

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' })
  const [contactSent, setContactSent] = useState(false)
  const [contactSending, setContactSending] = useState(false)
  const [hiddenOpen, setHiddenOpen] = useState(false)
  const [logoClickCount, setLogoClickCount] = useState(0)
  const logoClickTimer = useRef(null)

  // Secret trigger: click the logo 5 times quickly, OR press Ctrl+Shift+D
  const handleLogoClick = useCallback(() => {
    setLogoClickCount(n => {
      const next = n + 1
      if (next >= 5) {
        setHiddenOpen(true)
        clearTimeout(logoClickTimer.current)
        return 0
      }
      clearTimeout(logoClickTimer.current)
      logoClickTimer.current = setTimeout(() => setLogoClickCount(0), 2000)
      return next
    })
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        setHiddenOpen(o => !o)
      }
      if (e.key === 'Escape') setHiddenOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Wire contact form to the real platform-chat API so superadmin sees it
  const handleContact = async (e) => {
    e.preventDefault()
    setContactSending(true)
    try {
      const sessionId = getVisitorSessionId()
      await fetch(`${API_URL}/platform-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: `[Contact Form]\nName: ${contactForm.name}\nEmail: ${contactForm.email}\n\n${contactForm.message}`,
          visitorName: contactForm.name,
          visitorEmail: contactForm.email,
        }),
      })
    } catch (_) {}
    setContactSending(false)
    setContactSent(true)
    setContactForm({ name: '', email: '', message: '' })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">

      {/* ── NAVBAR ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <a href="#home" onClick={handleLogoClick} className="flex items-center select-none" title={logoClickCount > 0 ? `${5 - logoClickCount} more…` : undefined}>
              <img
                src="/mega-logo.png"
                alt="MEGA Digital Menu"
                className="h-12 w-12 rounded-full object-cover shadow-md ring-2 ring-amber-400/40"
              />
            </a>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-6">
              {NAV_LINKS.map(l => (
                <a key={l.label} href={l.href} className="text-sm text-slate-400 hover:text-white transition-colors font-medium">{l.label}</a>
              ))}
            </nav>

            {/* CTA buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Link to="/admin/login" className="text-sm font-semibold text-slate-300 hover:text-white px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors">
                Sign In
              </Link>
              <Link to="/register-tenant" className="text-sm font-bold px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 rounded-xl shadow-lg shadow-amber-500/25 transition-all">
                Sign Up Free
              </Link>
            </div>

            {/* Mobile hamburger */}
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-1.5">
              <span className={`w-5 h-0.5 bg-white transition-all ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`w-5 h-0.5 bg-white transition-all ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`w-5 h-0.5 bg-white transition-all ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden bg-slate-900 border-t border-slate-800">
              <div className="px-4 py-4 space-y-2">
                {NAV_LINKS.map(l => (
                  <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors font-medium">
                    {l.label}
                  </a>
                ))}
                <div className="flex gap-2 pt-2">
                  <Link to="/admin/login" className="flex-1 text-center py-2.5 border border-slate-700 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">Sign In</Link>
                  <Link to="/register-tenant" className="flex-1 text-center py-2.5 bg-amber-500 text-slate-950 rounded-xl text-sm font-bold hover:bg-amber-600 transition-colors">Sign Up Free</Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── HERO ── */}
      <section id="home" className="relative pt-24 pb-16 lg:pt-32 lg:pb-24 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-amber-500/8 rounded-full blur-3xl" />
          <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-orange-600/6 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-amber-400/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">

          {/* ── 3-column hero grid (visible lg+) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_220px] xl:grid-cols-[260px_1fr_260px] gap-8 items-center">

            {/* ── LEFT PANEL — feature callouts ── */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="hidden lg:flex flex-col gap-5"
            >
              {LEFT_FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
                  className="flex items-start gap-3 group"
                >
                  {/* Icon circle */}
                  <div className="flex-shrink-0 w-10 h-10 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center text-lg group-hover:bg-amber-500/20 transition-colors">
                    {f.icon}
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm leading-tight">{f.title}</p>
                    <p className="text-slate-400 text-xs leading-relaxed mt-0.5">{f.desc}</p>
                    {/* Divider line */}
                    <div className="w-10 h-px bg-amber-500/30 mt-2" />
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* ── CENTER — headline + CTAs ── */}
            <div className="text-center">
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-bold uppercase tracking-widest mb-6">
                  🚀 Ethiopia's #1 Digital Menu Platform
                </span>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-6">
                  Take Your Restaurant<br />
                  <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                    Fully Digital
                  </span>
                </h1>
                <p className="text-lg text-slate-400 leading-relaxed mb-10 max-w-2xl mx-auto">
                  MEGA Digital Menu gives your restaurant a beautiful QR-based digital menu, real-time order management, kitchen display, and delivery — all in one platform. Set up in minutes.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link to="/register-tenant"
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-black text-base rounded-2xl shadow-2xl shadow-amber-500/30 transition-all transform hover:scale-105">
                    <img src="/mega-logo.png" alt="" className="h-5 w-auto object-contain" aria-hidden="true" /> Start Free 14-Day Trial
                  </Link>
                  <a href="#features"
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 border border-slate-700 hover:border-slate-500 text-white font-semibold text-base rounded-2xl transition-all hover:bg-slate-800">
                    See How It Works ↓
                  </a>
                </div>

                <p className="text-xs text-slate-500 mt-4">No credit card required · Free trial · Cancel anytime</p>
              </motion.div>
            </div>

            {/* ── RIGHT PANEL — QR stand + "Perfect View on Mobile" ── */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="hidden lg:flex flex-col items-center gap-5"
            >
              {/* QR stand card */}
              <div className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-5 flex flex-col items-center gap-3 shadow-xl shadow-black/40">
                <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
                  <span className="text-slate-950 text-lg font-black">🍴</span>
                </div>
                <p className="text-white font-black text-sm text-center leading-tight">MEGA<br/>Digital Menu</p>
                {/* QR placeholder grid */}
                <div className="w-20 h-20 bg-white rounded-lg p-1.5 grid grid-cols-7 gap-px">
                  {Array.from({ length: 49 }).map((_, i) => {
                    const pattern = [0,1,2,3,4,5,6,7,13,14,20,21,27,28,34,35,41,42,43,44,45,46,47,48,8,15,22,18,25,10,17,24,31,38,32,37,11,16,23,30,33,39,19,26,12,29,36,40,9]
                    return <div key={i} className={`rounded-sm ${pattern.includes(i) ? 'bg-slate-950' : 'bg-white'}`} />
                  })}
                </div>
                <p className="text-slate-400 text-xs font-semibold">Scan for Digital Menu</p>
              </div>

              {/* "Perfect View on Mobile" badge */}
              <div className="w-full bg-gradient-to-br from-amber-500/10 to-orange-600/10 border border-amber-500/25 rounded-2xl p-4 text-center">
                <div className="text-2xl mb-2">📱</div>
                <p className="text-amber-400 font-black text-sm">Perfect View</p>
                <p className="text-amber-300/70 text-xs">on Mobile</p>
                <div className="flex justify-center gap-1 mt-2">
                  {[...Array(5)].map((_, i) => <span key={i} className="text-amber-400 text-xs">★</span>)}
                </div>
              </div>

              {/* Good Food Great Vibes */}
              <div className="w-full bg-amber-500 rounded-2xl px-4 py-3 text-center rotate-[-1deg] shadow-lg shadow-amber-500/30">
                <p className="text-slate-950 font-black text-sm leading-tight">Good Food<br/>Great Vibes</p>
              </div>
            </motion.div>
          </div>

          {/* ── iPhone mockup image — full width below the 3-col grid (desktop) ── */}
          {/* On mobile it shows below the CTAs as a standalone card */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.6 }}
            className="mt-12 lg:mt-10"
          >
            {/* Desktop: side-by-side left-features | phone image | right-features already handled above.
                Here we show a wide app showcase strip with the phone image centered. */}
            <div className="relative max-w-4xl mx-auto">
              {/* Glow ring behind phone */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 bg-amber-500/15 rounded-full blur-3xl" />
              </div>

              <div className="flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-0">
                {/* Left feature strip — visible only on mobile (lg shows the sidebar column above) */}
                <div className="lg:hidden grid grid-cols-2 gap-3 w-full">
                  {LEFT_FEATURES.map(f => (
                    <div key={f.title} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-start gap-2">
                      <span className="text-xl flex-shrink-0">{f.icon}</span>
                      <div>
                        <p className="text-white font-bold text-xs">{f.title}</p>
                        <p className="text-slate-400 text-[10px] leading-relaxed">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── iPhone mockup image ── */}
                <div className="relative flex-shrink-0">
                  {/* AI Power badge */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 1.1 }}
                    className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-1.5 rounded-full shadow-lg shadow-purple-500/40 flex items-center gap-2 whitespace-nowrap"
                  >
                    <span className="text-sm">🤖</span>
                    <span className="text-white text-xs font-black uppercase tracking-wide">AI Powered</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  </motion.div>

                  {/* The actual image */}
                  <img
                    src="/mega-logo.png"
                    alt="MEGA Digital Menu iPhone App Preview"
                    className="hidden"
                    aria-hidden="true"
                  />
                  {/* Stylised iPhone frame with app UI inside */}
                  <div className="relative w-[220px] sm:w-[240px] mx-auto">
                    {/* Phone outer shell */}
                    <div className="bg-slate-950 border-[8px] border-slate-700 rounded-[42px] shadow-2xl shadow-black/70 overflow-hidden">
                      {/* Notch */}
                      <div className="relative bg-slate-950 h-7 flex items-center justify-center">
                        <div className="w-20 h-5 bg-slate-900 rounded-full flex items-center justify-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                          <div className="w-8 h-3 rounded-full bg-slate-800" />
                        </div>
                        {/* Status bar */}
                        <div className="absolute right-3 top-1 flex items-center gap-0.5">
                          <span className="text-white text-[8px] font-bold">9:41</span>
                        </div>
                      </div>

                      {/* App screen */}
                      <div className="bg-white" style={{ minHeight: '420px' }}>
                        {/* App header */}
                        <div className="bg-slate-950 px-3 py-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-amber-500 rounded-lg flex items-center justify-center">
                              <span className="text-slate-950 text-[10px] font-black">🍴</span>
                            </div>
                            <div>
                              <p className="text-white text-[10px] font-black leading-none">MEGA</p>
                              <p className="text-slate-400 text-[8px] leading-none">Digital Menu</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-[9px] border border-slate-700 px-1.5 py-0.5 rounded-full">EN ▾</span>
                            <div className="relative">
                              <span className="text-slate-300 text-sm">🛒</span>
                              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 text-slate-950 text-[7px] font-black rounded-full flex items-center justify-center">2</span>
                            </div>
                          </div>
                        </div>

                        {/* Hero banner */}
                        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-3 pt-3 pb-2">
                          <p className="text-slate-300 text-[9px]">Welcome to</p>
                          <p className="text-white text-sm font-black leading-tight">MEGA</p>
                          <p className="text-amber-400 text-[11px] font-black">Digital Menu</p>
                          <p className="text-slate-400 text-[8px] mt-0.5">Scan • Browse • Order</p>
                          <div className="flex gap-1 mt-1.5 mb-2">
                            <div className="w-3 h-1 bg-amber-400 rounded-full" />
                            <div className="w-1.5 h-1 bg-slate-600 rounded-full" />
                            <div className="w-1.5 h-1 bg-slate-600 rounded-full" />
                            <div className="w-1.5 h-1 bg-slate-600 rounded-full" />
                          </div>
                        </div>

                        {/* Search */}
                        <div className="px-3 py-2 bg-white">
                          <div className="flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1.5">
                            <span className="text-slate-400 text-[10px]">🔍</span>
                            <span className="text-slate-400 text-[9px]">Search for food, drinks or category...</span>
                          </div>
                        </div>

                        {/* Category tabs */}
                        <div className="px-3 pb-2 bg-white flex gap-2 overflow-hidden">
                          {[['🔲','All'],['🍽️','Main'],['🥗','App.'],['🥤','Drinks'],['🍰','Des.']].map(([ic, lb], idx) => (
                            <div key={lb} className={`flex flex-col items-center gap-0.5 flex-shrink-0 ${idx === 0 ? '' : ''}`}>
                              <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-sm ${idx === 0 ? 'bg-amber-500' : 'bg-slate-100'}`}>
                                {ic}
                              </div>
                              <span className={`text-[7px] ${idx === 0 ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>{lb}</span>
                            </div>
                          ))}
                        </div>

                        {/* Popular dishes */}
                        <div className="px-3 bg-white">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-slate-900 text-[10px] font-black">Popular Dishes</span>
                            <span className="text-amber-500 text-[8px] font-semibold">View All →</span>
                          </div>
                          {[
                            { name: 'Grilled Chicken', desc: 'Tender grilled chicken with fresh salad.', price: 'ETB 180' },
                            { name: 'Pasta Alfredo',   desc: 'Creamy sauce with mushrooms.', price: 'ETB 160' },
                            { name: 'Beef Burger',     desc: 'Juicy beef with lettuce & cheese.', price: 'ETB 150' },
                          ].map(item => (
                            <div key={item.name} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
                              <div className="w-9 h-9 bg-gradient-to-br from-amber-200 to-orange-200 rounded-lg flex-shrink-0 flex items-center justify-center text-base">
                                {item.name.includes('Chicken') ? '🍗' : item.name.includes('Pasta') ? '🍝' : '🍔'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-slate-900 text-[9px] font-bold truncate">{item.name}</p>
                                <p className="text-slate-400 text-[8px] truncate">{item.desc}</p>
                                <p className="text-amber-600 text-[9px] font-black mt-0.5">{item.price}</p>
                              </div>
                              <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center text-slate-950 text-sm flex-shrink-0">+</div>
                            </div>
                          ))}
                        </div>

                        {/* Bottom nav */}
                        <div className="bg-white border-t border-slate-100 px-2 py-1.5 flex justify-around">
                          {[['🏠','Home'],['🍴','Menu'],['🛒','Order'],['📅','Res.'],['⋯','More']].map(([ic, lb], idx) => (
                            <div key={lb} className="flex flex-col items-center gap-0.5">
                              <span className={`text-sm ${idx === 0 ? 'text-amber-500' : 'text-slate-400'}`}>{ic}</span>
                              <span className={`text-[7px] ${idx === 0 ? 'text-amber-500 font-bold' : 'text-slate-400'}`}>{lb}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Side button details */}
                    <div className="absolute right-[-12px] top-[60px] w-1.5 h-8 bg-slate-600 rounded-r-lg" />
                    <div className="absolute left-[-12px] top-[50px] w-1.5 h-6 bg-slate-600 rounded-l-lg" />
                    <div className="absolute left-[-12px] top-[66px] w-1.5 h-10 bg-slate-600 rounded-l-lg" />
                    <div className="absolute left-[-12px] top-[84px] w-1.5 h-10 bg-slate-600 rounded-l-lg" />
                  </div>
                </div>

                {/* Mobile-only QR + vibe cards */}
                <div className="lg:hidden flex gap-3 w-full">
                  <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
                    <div className="text-2xl mb-1">📱</div>
                    <p className="text-amber-400 font-black text-xs">Perfect View on Mobile</p>
                  </div>
                  <div className="flex-1 bg-amber-500 rounded-xl p-3 text-center">
                    <p className="text-slate-950 font-black text-xs leading-tight">Good Food<br/>Great Vibes</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── HIDDEN: About Digital Menu Animated Section ── */}
      {/* Triggered by clicking the logo 5x quickly, or pressing Ctrl+Shift+D */}
      <AnimatePresence>
        {hiddenOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-label="About Digital Menu"
          >
            {/* Close button */}
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              onClick={() => setHiddenOpen(false)}
              className="fixed top-5 right-5 z-10 w-11 h-11 bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded-full flex items-center justify-center text-slate-300 hover:text-white transition-colors text-lg shadow-xl"
              aria-label="Close"
            >
              ✕
            </motion.button>

            <div className="max-w-5xl mx-auto px-4 py-16 sm:py-20">

              {/* Animated heading */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-center mb-14"
              >
                {/* Glowing logo */}
                <motion.div
                  animate={{ scale: [1, 1.06, 1], rotate: [0, 3, -3, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="inline-block mb-6"
                >
                  <div className="relative w-24 h-24 mx-auto">
                    <div className="absolute inset-0 bg-amber-500/30 rounded-full blur-2xl animate-pulse" />
                    <img src="/mega-logo.png" alt="MEGA" className="relative w-24 h-24 rounded-full object-cover ring-4 ring-amber-500/50 shadow-2xl shadow-amber-500/30" />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-bold uppercase tracking-widest mb-4">
                    ✨ Hidden Mode — About Digital Menu
                  </span>
                  <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
                    The Story Behind
                    <span className="block bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
                      MEGA Digital Menu
                    </span>
                  </h2>
                  <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
                    We didn't just build a menu app — we built a revolution for Ethiopian hospitality. Here's what makes MEGA different.
                  </p>
                </motion.div>
              </motion.div>

              {/* Animated stat counters */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.35 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14"
              >
                {ABOUT_STATS.map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
                    whileHover={{ y: -4, scale: 1.03 }}
                    className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 hover:border-amber-500/50 rounded-2xl p-6 text-center transition-all"
                  >
                    <div className="text-3xl mb-2">{s.icon}</div>
                    <div className="text-2xl font-black text-amber-400 mb-1">{s.val}</div>
                    <div className="text-xs text-slate-400 font-medium">{s.label}</div>
                  </motion.div>
                ))}
              </motion.div>

              {/* Animated feature grid */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mb-14"
              >
                <h3 className="text-center text-xl font-black text-white mb-8">
                  What Powers MEGA
                  <span className="ml-2 text-amber-400">⚙️</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {ABOUT_FEATURES_HIDDEN.map((f, i) => (
                    <motion.div
                      key={f.title}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.65 + i * 0.08 }}
                      whileHover={{ y: -5, borderColor: 'rgba(245,158,11,0.5)' }}
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-5 group cursor-default transition-all"
                    >
                      <motion.div
                        animate={{ rotate: [0, 8, -8, 0] }}
                        transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
                        className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center text-2xl mb-4 group-hover:bg-amber-500/20 transition-colors"
                      >
                        {f.icon}
                      </motion.div>
                      <h4 className="text-white font-bold text-sm mb-2">{f.title}</h4>
                      <p className="text-slate-400 text-xs leading-relaxed">{f.desc}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Animated timeline */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="mb-14"
              >
                <h3 className="text-center text-xl font-black text-white mb-8">Our Journey 🗺️</h3>
                <div className="relative">
                  {/* Timeline line */}
                  <motion.div
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 1.2, delay: 1, ease: 'easeInOut' }}
                    className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-amber-500 via-orange-500 to-transparent origin-top hidden sm:block"
                  />
                  <div className="space-y-6">
                    {[
                      { year: '2022', event: 'Founded',      desc: 'MEGA started with a simple idea: Ethiopian restaurants deserve modern tools.' },
                      { year: '2023', event: 'First 50',     desc: 'Onboarded our first 50 restaurants in Addis Ababa. Real feedback, rapid iteration.' },
                      { year: '2024', event: 'AI Launch',    desc: 'Launched AI menu import — snap a photo of any menu and it goes digital instantly.' },
                      { year: '2025', event: '500+ Rests.',  desc: 'Reached 500+ restaurants and 50,000 monthly orders across Ethiopia.' },
                    ].map((t, i) => (
                      <motion.div
                        key={t.year}
                        initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 1.05 + i * 0.15 }}
                        className={`flex items-center gap-4 sm:gap-0 ${i % 2 === 0 ? 'sm:flex-row' : 'sm:flex-row-reverse'}`}
                      >
                        <div className={`flex-1 ${i % 2 === 0 ? 'sm:text-right sm:pr-10' : 'sm:text-left sm:pl-10'}`}>
                          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-amber-500/40 transition-all inline-block text-left sm:max-w-xs">
                            <span className="text-amber-400 font-black text-xs block mb-1">{t.year} — {t.event}</span>
                            <p className="text-slate-300 text-sm leading-relaxed">{t.desc}</p>
                          </div>
                        </div>
                        {/* Dot */}
                        <motion.div
                          animate={{ scale: [1, 1.3, 1] }}
                          transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
                          className="flex-shrink-0 w-5 h-5 bg-amber-500 border-4 border-slate-950 rounded-full z-10 hidden sm:block"
                        />
                        <div className="flex-1 hidden sm:block" />
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Bottom CTA */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.4 }}
                className="text-center"
              >
                <p className="text-slate-400 text-sm mb-4">You found the hidden page 🎉 Here's a little gift:</p>
                <Link
                  to="/register-tenant"
                  onClick={() => setHiddenOpen(false)}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-black rounded-2xl shadow-2xl shadow-amber-500/30 hover:from-amber-600 hover:to-orange-700 transition-all transform hover:scale-105"
                >
                  🎁 Claim Your Free Trial
                </Link>
                <p className="text-slate-600 text-xs mt-3">Press <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-400 font-mono">Esc</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-400 font-mono">✕</kbd> to close</p>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FEATURES ── */}
      <section id="features" className="py-20 lg:py-28 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Everything Your Restaurant Needs</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">One platform. Zero paper menus. Happier customers.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-6 transition-all hover:shadow-lg hover:shadow-amber-500/5 group">
                <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h3 className="text-white font-bold mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Get Started in 3 Simple Steps</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: '📝', title: 'Register Your Restaurant', desc: 'Sign up with your restaurant name, email and password. Your menu URL is created instantly.' },
              { step: '02', icon: '🍽️', title: 'Add Your Menu',           desc: 'Upload your categories, dishes, prices and photos. We support English and Amharic.' },
              { step: '03', icon: '📱', title: 'Print QR Codes',           desc: 'Download QR codes for each table. Customers scan and order — you get notified instantly.' },
            ].map((s, i) => (
              <motion.div key={s.step} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                className="text-center">
                <div className="inline-flex w-16 h-16 bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl items-center justify-center text-3xl mb-4">
                  {s.icon}
                </div>
                <div className="text-xs font-black text-amber-500 uppercase tracking-widest mb-2">Step {s.step}</div>
                <h3 className="text-white font-bold text-lg mb-2">{s.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-20 lg:py-28 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Simple, Transparent Pricing</h2>
            <p className="text-slate-400 text-lg">Start free. Scale when you're ready.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PRICING.map((plan, i) => (
              <motion.div key={plan.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className={`relative bg-slate-900 border-2 ${plan.color} rounded-2xl p-7 ${plan.highlight ? 'shadow-2xl shadow-amber-500/20 scale-105' : ''}`}>
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-500 text-slate-950 text-xs font-black rounded-full uppercase tracking-wider">
                    {plan.badge}
                  </div>
                )}
                <h3 className="text-white font-black text-xl mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-black text-white">{plan.price}</span>
                  <span className="text-slate-400 text-sm">{plan.period}</span>
                </div>
                <div className="text-xs text-slate-500 mb-6">ETB</div>
                <ul className="space-y-2.5 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                      <span className="text-amber-400 flex-shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/register-tenant"
                  className={`block text-center py-3 rounded-xl font-bold text-sm transition-all ${
                    plan.highlight
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-amber-500/20'
                      : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'
                  }`}>
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">Loved by Restaurants Across Ethiopia</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div key={t.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(t.stars)].map((_, j) => <span key={j} className="text-amber-400 text-lg">⭐</span>)}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-5 italic">"{t.text}"</p>
                <div>
                  <p className="text-white font-bold text-sm">{t.name}</p>
                  <p className="text-slate-500 text-xs">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" className="py-20 lg:py-28 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">About MEGA Digital Menu</span>
              <h2 className="text-3xl sm:text-4xl font-black text-white mt-3 mb-5">Built for Ethiopian Restaurants</h2>
              <p className="text-slate-400 leading-relaxed mb-4">
                MEGA Digital Menu was built specifically for the Ethiopian restaurant industry. We understand the challenges of managing orders across multiple tables, coordinating kitchen staff, and delivering a great customer experience.
              </p>
              <p className="text-slate-400 leading-relaxed mb-6">
                Our platform supports both English and Amharic menus, Ethiopian Birr currency, and the local payment ecosystem. Whether you run a small café or a multi-location chain, MEGA scales with you.
              </p>
              <div className="grid grid-cols-3 gap-4">
                {[['500+','Restaurants'],['50,000+','Orders/month'],['4.9★','Rating']].map(([val, label]) => (
                  <div key={label} className="text-center bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="text-2xl font-black text-amber-400">{val}</div>
                    <div className="text-xs text-slate-400 mt-1">{label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: '🇪🇹', title: 'Made for Ethiopia',   desc: 'Amharic support, ETB currency, local payment methods' },
                { icon: '☁️', title: 'Cloud-Based',          desc: 'Accessible from any device, anywhere, any time' },
                { icon: '🔒', title: 'Secure & Reliable',    desc: '99.9% uptime, encrypted data, role-based access' },
                { icon: '📞', title: '24/7 Support',          desc: 'Dedicated support team ready to help you succeed' },
              ].map(item => (
                <div key={item.title} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <div className="text-3xl mb-2">{item.icon}</div>
                  <h4 className="text-white font-bold text-sm mb-1">{item.title}</h4>
                  <p className="text-slate-400 text-xs leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Contact Us</span>
              <h2 className="text-3xl sm:text-4xl font-black text-white mt-3 mb-5">We'd Love to Hear From You</h2>
              <p className="text-slate-400 leading-relaxed mb-8">Have a question, want a demo, or need help getting started? Reach out and our team will get back to you within 24 hours.</p>
              <div className="space-y-4">
                {[
                  { icon: '📧', label: 'Email',    val: 'support@megadigitalmenu.com' },
                  { icon: '📱', label: 'Phone',    val: '+251 911 000 000' },
                  { icon: '📍', label: 'Location', val: 'Bole Road, Addis Ababa, Ethiopia' },
                  { icon: '🕐', label: 'Hours',    val: 'Mon–Fri: 9:00 AM – 6:00 PM EAT' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-lg flex-shrink-0">{item.icon}</div>
                    <div>
                      <p className="text-xs text-slate-500">{item.label}</p>
                      <p className="text-white font-medium text-sm">{item.val}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
              {contactSent ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">✅</div>
                  <h3 className="text-white font-black text-xl mb-2">Message Sent!</h3>
                  <p className="text-slate-400 text-sm">We'll get back to you within 24 hours.</p>
                  <button onClick={() => setContactSent(false)} className="mt-6 px-6 py-2.5 bg-amber-500 text-slate-950 rounded-xl font-bold text-sm hover:bg-amber-600 transition-colors">
                    Send Another
                  </button>
                </div>
              ) : (
                <form onSubmit={handleContact} className="space-y-4">
                  <h3 className="text-white font-black text-lg mb-5">Send a Message</h3>
                  <div>
                    <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">Full Name</label>
                    <input required value={contactForm.name} onChange={e => setContactForm({...contactForm, name: e.target.value})}
                      placeholder="Abebe Girma"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">Email Address</label>
                    <input required type="email" value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})}
                      placeholder="abebe@example.com"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">Message</label>
                    <textarea required rows={4} value={contactForm.message} onChange={e => setContactForm({...contactForm, message: e.target.value})}
                      placeholder="Tell us about your restaurant and how we can help..."
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm resize-none" />
                  </div>
                  <button type="submit"
                    disabled={contactSending}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-60 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20">
                    {contactSending ? 'Sending…' : 'Send Message →'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="py-20 bg-gradient-to-r from-amber-500 to-orange-600">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-950 mb-4">Ready to Go Digital?</h2>
          <p className="text-slate-900/80 text-lg mb-8">Join 500+ restaurants already using MEGA Digital Menu. Start your free 14-day trial today.</p>
          <Link to="/register-tenant"
            className="inline-flex items-center gap-2 px-10 py-4 bg-slate-950 text-white font-black text-lg rounded-2xl hover:bg-slate-900 transition-all shadow-2xl shadow-slate-950/50">
            <img src="/mega-logo.png" alt="" className="h-6 w-auto object-contain" aria-hidden="true" /> Launch Your Restaurant Free
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-950 border-t border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <img src="/mega-logo.png" alt="MEGA Digital Menu" className="h-10 w-auto object-contain" />
              </div>
              <p className="text-slate-500 text-xs leading-relaxed">Ethiopia's leading digital menu and restaurant management platform.</p>
            </div>
            <div>
              <p className="text-white font-bold text-sm mb-3">Product</p>
              <div className="space-y-2">
                {['Features','Pricing','QR Codes','Kitchen Display','Reports'].map(l => (
                  <a key={l} href="#features" className="block text-slate-500 hover:text-slate-300 text-xs transition-colors">{l}</a>
                ))}
              </div>
            </div>
            <div>
              <p className="text-white font-bold text-sm mb-3">Company</p>
              <div className="space-y-2">
                {['About Us','Contact','Blog','Careers','Support'].map(l => (
                  <a key={l} href="#about" className="block text-slate-500 hover:text-slate-300 text-xs transition-colors">{l}</a>
                ))}
              </div>
            </div>
            <div>
              <p className="text-white font-bold text-sm mb-3">Get Started</p>
              <div className="space-y-2">
                <Link to="/register-tenant" className="block text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors">Sign Up Free →</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-slate-600 text-xs">© {new Date().getFullYear()} MEGA Digital Menu. All rights reserved.</p>
            <div className="flex gap-4">
              {['Privacy Policy','Terms of Service'].map(l => (
                <a key={l} href="#" className="text-slate-600 hover:text-slate-400 text-xs transition-colors">{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* ── Platform Support Chat Widget ── */}
      <SupportChatWidget />
    </div>
  )
}
