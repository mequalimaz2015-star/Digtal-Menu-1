import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import client from '../../api/client'
import { UtensilsCrossed, CheckCircle, ArrowRight, ExternalLink } from 'lucide-react'

export default function TenantRegistration() {
  const [formData, setFormData] = useState({
    restaurant_name: '',
    slug: '',
    admin_name: '',
    email: '',
    phone: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(null) // { tenant, token }
  const navigate = useNavigate()

  const handleNameChange = (e) => {
    const val = e.target.value
    const autoSlug = val.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    setFormData((prev) => ({ ...prev, restaurant_name: val, slug: autoSlug }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await client.post('/tenants/register', formData)

      // Clear any previous restaurant's session before writing new one
      localStorage.removeItem('token')
      localStorage.removeItem('admin-user')
      localStorage.removeItem('tenant_slug')

      // Store the new restaurant's auth context
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('admin-user', JSON.stringify(res.data.user))
      localStorage.setItem('tenant_slug', res.data.tenant.slug)

      // Show success screen before redirecting
      setSuccess({ tenant: res.data.tenant, token: res.data.token })
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please check your inputs.')
    } finally {
      setLoading(false)
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) {
    const { tenant } = success
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl w-full mx-auto space-y-8 bg-slate-900 border border-emerald-500/20 p-8 sm:p-10 rounded-3xl shadow-2xl">
          <div className="text-center space-y-4">
            <div className="inline-flex p-4 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              🎉 {tenant.name} is Live!
            </h2>
            <p className="text-slate-400 text-sm">
              Your restaurant has been registered successfully. Your digital menu is ready at:
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl font-mono text-amber-400 text-sm">
              /r/{tenant.slug}/menu
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a
              href={`/r/${tenant.slug}/menu`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View Your Menu
            </a>
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20"
            >
              Go to Admin Panel <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 space-y-3">
            <h3 className="text-white font-bold text-sm">📋 Your Registration Details</h3>
            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <span className="text-slate-400">Restaurant</span>
              <span className="text-white font-medium">{tenant.name}</span>
              <span className="text-slate-400">Slug</span>
              <span className="text-amber-400 font-mono">{tenant.slug}</span>
              <span className="text-slate-400">Plan</span>
              <span className="text-white">Free Trial (14 days)</span>
              <span className="text-slate-400">Menu URL</span>
              <span className="text-amber-400 font-mono text-[11px] break-all">/r/{tenant.slug}/menu</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Registration form ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full mx-auto space-y-8 bg-slate-900 border border-slate-800 p-8 sm:p-10 rounded-3xl shadow-2xl backdrop-blur-xl">
        <div className="text-center space-y-3">
          <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-2">
            <UtensilsCrossed className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Launch Your Digital Menu</h2>
          <p className="text-slate-400 text-sm">
            Start your <span className="text-amber-400 font-semibold">14-day free trial</span>. No credit card required.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Restaurant Name
            </label>
            <input
              type="text"
              required
              value={formData.restaurant_name}
              onChange={handleNameChange}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              placeholder="e.g. Abyssinian Gourmet"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Your Public URL Slug
            </label>
            <div className="flex items-center">
              <span className="px-3 py-3 bg-slate-850 border border-r-0 border-slate-700 rounded-l-xl text-xs text-slate-400 font-mono">
                /r/
              </span>
              <input
                type="text"
                required
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-r-xl text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500"
                placeholder="abyssinian-gourmet"
              />
            </div>
            {formData.slug && (
              <p className="text-xs text-slate-500 mt-1.5 ml-1">Menu URL: <span className="text-amber-400">/r/{formData.slug}/menu</span></p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Owner / Manager Name
              </label>
              <input
                type="text"
                required
                value={formData.admin_name}
                onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                placeholder="Abebe Bikila"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Phone Number
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                placeholder="+251 911 000 000"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              placeholder="owner@restaurant.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 px-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-bold text-base rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Creating Your Digital Restaurant...' : <> Create Restaurant Menu Now <ArrowRight className="w-5 h-5" /></>}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-800 text-center text-xs text-slate-400">
          Already have a restaurant account?{' '}
          <Link to="/admin/login" className="text-amber-400 hover:underline font-semibold">
            Sign in here
          </Link>
        </div>
      </div>
    </div>
  )
}
