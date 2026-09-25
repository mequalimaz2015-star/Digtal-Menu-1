import { useState, useEffect } from 'react'
import client from '../../api/client'
import {
  Building2, Plus, Search, Power, ExternalLink, CheckCircle,
  AlertTriangle, Edit3, Trash2, RefreshCw, ChevronDown, X, Globe
} from 'lucide-react'

const STATUS_STYLES = {
  active:    'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  trial:     'bg-amber-500/15   text-amber-400   border border-amber-500/25',
  suspended: 'bg-red-500/15     text-red-400     border border-red-500/25',
}

function TenantModal({ isOpen, onClose, onSave, plans, initial }) {
  const [form, setForm] = useState(initial || {
    name: '', slug: '', email: '', phone: '', address: '', plan_id: 1, admin_password: ''
  })
  const isEdit = !!initial?.id

  useEffect(() => { if (initial) setForm(initial) }, [initial])

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">
            {isEdit ? 'Edit Restaurant' : 'Provision New Restaurant'}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Restaurant Name *</label>
              <input
                type="text" required value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                placeholder="e.g. Skyline Bistro"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">URL Slug *</label>
              <input
                type="text" required value={form.slug}
                onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-amber-500"
                placeholder="skyline-bistro"
              />
              {form.slug && <p className="text-xs text-slate-500 mt-1">/r/{form.slug}/menu</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Phone</label>
              <input
                type="tel" value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                placeholder="+251..."
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Admin Email *</label>
              <input
                type="email" required value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                placeholder="owner@restaurant.com"
              />
            </div>
            {!isEdit && (
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Admin Password *</label>
                <input
                  type="password" required={!isEdit} value={form.admin_password}
                  onChange={e => setForm({ ...form, admin_password: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                  placeholder="Min. 8 characters"
                />
              </div>
            )}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Address</label>
              <input
                type="text" value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                placeholder="Addis Ababa, Ethiopia"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Subscription Plan</label>
              <select
                value={form.plan_id}
                onChange={e => setForm({ ...form, plan_id: parseInt(e.target.value) })}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
              >
                {plans.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {p.price_etb} ETB/mo</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-sm font-bold shadow-lg shadow-amber-500/20 transition-colors">
              {isEdit ? 'Save Changes' : 'Provision Tenant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const TENANTS_CACHE_KEY = 'superadmin_tenants_cache'
const PLANS_CACHE_KEY   = 'superadmin_plans_cache'

export default function SATenants() {
  const [tenants, setTenants] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modal, setModal] = useState({ open: false, initial: null })
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [usingCache, setUsingCache] = useState(false)

  const load = async () => {
    setLoading(true)
    setLoadError(null)
    setUsingCache(false)
    try {
      const [tRes, pRes] = await Promise.allSettled([
        client.get('/superadmin/tenants'),
        client.get('/superadmin/plans'),
      ])

      if (tRes.status === 'fulfilled' && Array.isArray(tRes.value.data)) {
        setTenants(tRes.value.data)
        // ✅ Persist to localStorage so we can show them when offline
        try { localStorage.setItem(TENANTS_CACHE_KEY, JSON.stringify(tRes.value.data)) } catch (_) {}
      } else if (tRes.status === 'rejected') {
        console.error('Tenants load failed:', tRes.reason)
        // 🔄 Fall back to cached list so restaurants are always visible
        try {
          const cached = JSON.parse(localStorage.getItem(TENANTS_CACHE_KEY) || 'null')
          if (Array.isArray(cached) && cached.length > 0) {
            setTenants(cached)
            setUsingCache(true)
          } else {
            setLoadError(tRes.reason?.response?.data?.error || tRes.reason?.message || 'Could not connect to backend server. Make sure the API is running.')
          }
        } catch (_) {
          setLoadError(tRes.reason?.message || 'Failed to load restaurants')
        }
      }

      if (pRes.status === 'fulfilled' && Array.isArray(pRes.value.data)) {
        setPlans(pRes.value.data)
        try { localStorage.setItem(PLANS_CACHE_KEY, JSON.stringify(pRes.value.data)) } catch (_) {}
      } else {
        // Fall back to cached plans
        try {
          const cachedPlans = JSON.parse(localStorage.getItem(PLANS_CACHE_KEY) || 'null')
          if (Array.isArray(cachedPlans)) setPlans(cachedPlans)
        } catch (_) {}
      }
    } catch (err) {
      console.error('Superadmin error:', err)
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Load cached data immediately so the list appears before the API responds
    try {
      const cached = JSON.parse(localStorage.getItem(TENANTS_CACHE_KEY) || 'null')
      if (Array.isArray(cached) && cached.length > 0) {
        setTenants(cached)
        setUsingCache(true)
      }
      const cachedPlans = JSON.parse(localStorage.getItem(PLANS_CACHE_KEY) || 'null')
      if (Array.isArray(cachedPlans)) setPlans(cachedPlans)
    } catch (_) {}
    load()
  }, [])


  const handleSave = async (form) => {
    try {
      if (form.id) {
        await client.put(`/superadmin/tenants/${form.id}`, form)
      } else {
        await client.post('/superadmin/tenants', form)
      }
      setModal({ open: false, initial: null })
      load()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save tenant')
    }
  }

  const handleToggleStatus = async (t) => {
    const next = t.status === 'active' ? 'suspended' : 'active'
    try {
      await client.put(`/superadmin/tenants/${t.id}/status`, { status: next })
      load()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed')
    }
  }

  const handleImpersonate = async (tenantId) => {
    try {
      const res = await client.post(`/superadmin/tenants/${tenantId}/impersonate`)
      const w = window.open('/admin', '_blank')
      if (w) {
        w.localStorage?.setItem('token', res.data.token)
      } else {
        localStorage.setItem('token', res.data.token)
        window.open('/admin', '_blank')
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to impersonate')
    }
  }

  const handleDelete = async (id) => {
    try {
      await client.delete(`/superadmin/tenants/${id}`)
      setConfirmDelete(null)
      load()
    } catch (err) {
      alert(err.response?.data?.error || 'Cannot delete tenant — has data')
    }
  }

  const filtered = tenants.filter(t => {
    const matchSearch = !search ||
      t.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.slug?.toLowerCase().includes(search.toLowerCase()) ||
      t.email?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <TenantModal
        isOpen={modal.open}
        onClose={() => setModal({ open: false, initial: null })}
        onSave={handleSave}
        plans={plans}
        initial={modal.initial}
      />

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-white font-bold text-lg mb-2">Delete Restaurant?</h3>
            <p className="text-slate-400 text-sm mb-6">
              This will permanently delete <strong className="text-white">{confirmDelete.name}</strong> and all associated data. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(confirmDelete.id)}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-colors">
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">Restaurants</h2>
          <p className="text-sm text-slate-400 mt-0.5">{tenants.length} registered restaurant{tenants.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setModal({ open: true, initial: null })}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-amber-500/20 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Restaurant
          </button>
        </div>
      </div>

      {/* Offline cache warning */}
      {usingCache && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>Backend offline</strong> — showing cached restaurant list. Start the API server and click <strong>↻ Refresh</strong> to sync live data.
          </span>
          <button onClick={load} className="ml-auto px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap">
            Retry
          </button>
        </div>
      )}

      {/* Hard error — no cache available */}
      {loadError && !usingCache && tenants.length === 0 && (
        <div className="flex flex-col gap-2 px-4 py-4 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <strong>Cannot connect to backend</strong>
          </div>
          <p className="text-slate-400 text-xs ml-6">{loadError}</p>
          <p className="text-slate-500 text-xs ml-6">Run <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-400">start-api.bat</code> to start the API server, then click Retry.</p>
          <button onClick={load} className="self-start ml-6 mt-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs transition-colors">
            Retry Connection
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, slug, email..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'active', 'trial', 'suspended'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold capitalize transition-colors ${
                statusFilter === s
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-800/40">
              <tr className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-4">Restaurant</th>
                <th className="px-5 py-4">Menu URL</th>
                <th className="px-5 py-4">Plan</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Usage</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-5 py-4">
                      <div className="h-8 bg-slate-800 rounded-lg animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-slate-500">
                    <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No restaurants found</p>
                  </td>
                </tr>
              ) : filtered.map(t => (
                <tr key={t.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-amber-400 text-sm">
                        {t.name?.[0] || '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{t.name}</p>
                        <p className="text-xs text-slate-500">{t.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <a
                      href={`/r/${t.slug}/menu`} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-mono text-xs text-amber-400 hover:underline"
                    >
                      /r/{t.slug} <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                  <td className="px-5 py-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                      {t.plan_name || 'Free Trial'} — {t.plan_price || 0} ETB
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_STYLES[t.status] || STATUS_STYLES.trial}`}>
                      {t.status === 'active' ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      {t.status || 'trial'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-400">
                    <span className="text-white font-medium">{t.item_count || 0}</span> items •{' '}
                    <span className="text-white font-medium">{t.order_count || 0}</span> orders
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleImpersonate(t.id)}
                        title="Support Login"
                        className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-medium transition-colors"
                      >
                        Login As
                      </button>
                      <button
                        onClick={() => setModal({ open: true, initial: t })}
                        title="Edit"
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(t)}
                        title={t.status === 'active' ? 'Suspend' : 'Activate'}
                        className={`p-1.5 border rounded-lg transition-colors ${
                          t.status === 'active'
                            ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(t)}
                        title="Delete"
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
