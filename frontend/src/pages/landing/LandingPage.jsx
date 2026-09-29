import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

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

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' })
  const [contactSent, setContactSent] = useState(false)

  const handleContact = (e) => {
    e.preventDefault()
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
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-orange-600 rounded-xl flex items-center justify-center text-xl shadow-lg">
                🍽️
              </div>
              <span className="font-black text-white text-lg tracking-tight">MEGA <span className="text-amber-400">Digital</span> Menu</span>
            </div>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-6">
              {NAV_LINKS.map(l => (
                <a key={l.label} href={l.href} className="text-sm text-slate-400 hover:text-white transition-colors font-medium">{l.label}</a>
              ))}
            </nav>

            {/* CTA buttons */}
            <div className="hidden md:flex items-center gap-3">
              <a href="/admin/login" className="text-sm font-semibold text-slate-300 hover:text-white px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors">
                Sign In
              </a>
              <a href="/register-tenant" className="text-sm font-bold px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 rounded-xl shadow-lg shadow-amber-500/25 transition-all">
                Sign Up Free
              </a>
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
                  <a href="/admin/login" className="flex-1 text-center py-2.5 border border-slate-700 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">Sign In</a>
                  <a href="/register-tenant" className="flex-1 text-center py-2.5 bg-amber-500 text-slate-950 rounded-xl text-sm font-bold hover:bg-amber-600 transition-colors">Sign Up Free</a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── HERO ── */}
      <section id="home" className="relative pt-24 pb-20 lg:pt-36 lg:pb-32 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-amber-500/8 rounded-full blur-3xl" />
          <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-orange-600/6 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-4xl mx-auto">
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
                <a href="/register-tenant"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-black text-base rounded-2xl shadow-2xl shadow-amber-500/30 transition-all transform hover:scale-105">
                  🍽️ Start Free 14-Day Trial
                </a>
                <a href="#features"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 border border-slate-700 hover:border-slate-500 text-white font-semibold text-base rounded-2xl transition-all hover:bg-slate-800">
                  See How It Works ↓
                </a>
              </div>

              <p className="text-xs text-slate-500 mt-4">No credit card required · Free trial · Cancel anytime</p>
            </motion.div>
          </div>

          {/* Hero mockup */}
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-16 max-w-5xl mx-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-2 shadow-2xl shadow-black/50">
              <div className="bg-slate-800 rounded-2xl p-4 sm:p-6">
                {/* Fake browser chrome */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500"/><div className="w-3 h-3 rounded-full bg-yellow-500"/><div className="w-3 h-3 rounded-full bg-green-500"/></div>
                  <div className="flex-1 bg-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-400 font-mono">digital-menu.app.aletcloud.com/r/your-restaurant</div>
                </div>
                {/* Dashboard preview */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[['💰','Today Revenue','4,850 ETB'],['🛒','Active Orders','7'],['🪑','Occupied Tables','5/8'],['✅','Served Today','23']].map(([icon,label,val])=>(
                    <div key={label} className="bg-slate-900 rounded-xl p-3 border border-slate-700">
                      <div className="text-xl mb-1">{icon}</div>
                      <div className="text-xs text-slate-400">{label}</div>
                      <div className="text-sm font-black text-white">{val}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-white">🔴 Live Orders</span>
                    <span className="text-xs text-green-400 font-semibold">● Live</span>
                  </div>
                  {[['ORD-4821','T3','Margherita Pizza × 1','preparing'],['ORD-4820','T7','Lamb Tibs × 2, Coffee × 2','ready'],['ORD-4819','T1','Buffalo Wings × 1','new']].map(([id,t,items,status])=>(
                    <div key={id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0 text-xs">
                      <span className="font-bold text-slate-300">#{id.slice(-4)}</span>
                      <span className="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold">{t}</span>
                      <span className="text-slate-400 flex-1 mx-3 truncate">{items}</span>
                      <span className={`px-2 py-0.5 rounded-full font-semibold capitalize ${status==='preparing'?'bg-yellow-500/20 text-yellow-400':status==='ready'?'bg-green-500/20 text-green-400':'bg-blue-500/20 text-blue-400'}`}>{status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

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
                <a href="/register-tenant"
                  className={`block text-center py-3 rounded-xl font-bold text-sm transition-all ${
                    plan.highlight
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-amber-500/20'
                      : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'
                  }`}>
                  {plan.cta}
                </a>
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
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20">
                    Send Message →
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
          <a href="/register-tenant"
            className="inline-flex items-center gap-2 px-10 py-4 bg-slate-950 text-white font-black text-lg rounded-2xl hover:bg-slate-900 transition-all shadow-2xl shadow-slate-950/50">
            🍽️ Launch Your Restaurant Free
          </a>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-950 border-t border-slate-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-600 rounded-lg flex items-center justify-center text-base">🍽️</div>
                <span className="font-black text-white text-sm">MEGA Digital Menu</span>
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
                <a href="/register-tenant" className="block text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors">Sign Up Free →</a>
                <a href="/admin/login" className="block text-slate-500 hover:text-slate-300 text-xs transition-colors">Restaurant Login</a>
                <a href="/superadmin/login" className="block text-slate-500 hover:text-slate-300 text-xs transition-colors">Admin Console</a>
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
    </div>
  )
}
