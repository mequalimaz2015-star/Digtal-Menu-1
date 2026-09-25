import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import {
  Shield, Building2, Users, DollarSign, Activity, Plus, Search,
  CheckCircle, AlertTriangle, ExternalLink, Power, Zap, Layers, RefreshCw, LogOut
} from 'lucide-react'

export default function SuperAdminDashboard() {
  const [metrics, setMetrics] = useState(null)
  const [tenants, setTenants] = useState([])
  const [plans, setPlans] = useState([])
  const [activeTab, setActiveTab] = useState('tenants')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTenant, setNewTenant] = useState({
    name: '', slug: '', email: '', phone: '', address: '', plan_id: 1, admin_password: ''
  })
  const navigate = useNavigate()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [mRes, tRes, pRes] = await Promise.all([
        client.get('/superadmin/dashboard'),
        client.get('/superadmin/tenants'),
        client.get('/superadmin/plans')
      ])
      setMetrics(mRes.data)
      setTenants(tRes.data)
      setPlans(pRes.data)
    } catch (err) {
      console.error('Failed to load superadmin data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (tenantId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active'
    try {
      await client.put(`/superadmin/tenants/${tenantId}/status`, { status: nextStatus })
      fetchData()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update tenant status')
    }
  }

  const handleImpersonate = async (tenantId) => {
    try {
      const res = await client.post(`/superadmin/tenants/${tenantId}/impersonate`)
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('tenant_slug', res.data.tenant.slug)
      window.open('/admin', '_blank')
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to impersonate tenant')
    }
  }

  const handleCreateTenant = async (e) => {
    e.preventDefault()
    try {
      await client.post('/superadmin/tenants', newTenant)
      setShowAddModal(false)
      setNewTenant({ name: '', slug: '', email: '', phone: '', address: '', plan_id: 1, admin_password: '' })
      fetchData()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create tenant')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('superadmin_token')
    localStorage.removeItem('superadmin_user')
    navigate('/superadmin/login')
  }

  const filteredTenants = tenants.filter(t =>
    t.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.slug?.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900/80 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
              Noble's Ecom Admin <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-md">Platform Owner</span>
            </h1>
            <p className="text-xs text-slate-400">Multi-Tenant Operations & Subscription Governance</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
        {/* Metric Cards */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Tenants</p>
                  <h3 className="text-3xl font-extrabold text-white mt-1">{metrics.total_tenants}</h3>
                </div>
                <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                  <Building2 className="w-6 h-6" />
                </div>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span className="text-emerald-400 font-semibold">{metrics.active_tenants} Active</span>
                <span>•</span>
                <span className="text-amber-400 font-semibold">{metrics.trial_tenants} Trial</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Estimated MRR</p>
                  <h3 className="text-3xl font-extrabold text-emerald-400 mt-1">
                    {metrics.mrr_etb?.toLocaleString()} <span className="text-sm font-normal text-slate-400">ETB</span>
                  </h3>
                </div>
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
              <p className="text-xs text-slate-400">Monthly Recurring Subscription Revenue</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Platform Orders</p>
                  <h3 className="text-3xl font-extrabold text-white mt-1">{metrics.total_orders_platform}</h3>
                </div>
                <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                  <Activity className="w-6 h-6" />
                </div>
              </div>
              <p className="text-xs text-slate-400">Total orders processed across all tenants</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Gross Sales Volume</p>
                  <h3 className="text-3xl font-extrabold text-white mt-1">
                    {metrics.total_revenue_platform?.toLocaleString()} <span className="text-sm font-normal text-slate-400">ETB</span>
                  </h3>
                </div>
                <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                  <Zap className="w-6 h-6" />
                </div>
              </div>
              <p className="text-xs text-slate-400">Cumulative sales GMV</p>
            </div>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('tenants')}
              className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2 ${activeTab === 'tenants'
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-lg shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
            >
              <Building2 className="w-4 h-4" /> Restaurant Tenants ({tenants.length})
            </button>

            <button
              onClick={() => setActiveTab('plans')}
              className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2 ${activeTab === 'plans'
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-lg shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
            >
              <Layers className="w-4 h-4" /> Subscription Plans ({plans.length})
            </button>
          </div>

          {activeTab === 'tenants' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
            >
              <Plus className="w-4 h-4" /> Provision New Tenant
            </button>
          )}
        </div>

        {/* TAB 1: TENANTS LIST */}
        {activeTab === 'tenants' && (
          <div className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search tenant name, slug, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-850 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-6 py-4">Restaurant Tenant</th>
                      <th className="px-6 py-4">Slug & URL</th>
                      <th className="px-6 py-4">Subscription Plan</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Usage Limits</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredTenants.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-amber-400">
                              {t.name?.[0]}
                            </div>
                            <div>
                              <div className="font-semibold text-white">{t.name}</div>
                              <div className="text-xs text-slate-500">{t.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <a
                            href={`/r/${t.slug}/menu`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 font-mono text-xs text-amber-400 hover:underline"
                          >
                            /r/{t.slug} <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-200 border border-slate-700">
                            {t.plan_name || 'Free Trial'} ({t.plan_price || 0} ETB/mo)
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {t.status === 'active' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle className="w-3.5 h-3.5" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
                              <AlertTriangle className="w-3.5 h-3.5" /> {t.status}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400">
                          <div>Items: <span className="text-white font-medium">{t.item_count || 0}</span></div>
                          <div>Orders: <span className="text-white font-medium">{t.order_count || 0}</span></div>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => handleImpersonate(t.id)}
                            className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-medium transition-colors"
                            title="Log in as tenant admin for support"
                          >
                            Support Login
                          </button>
                          <button
                            onClick={() => handleToggleStatus(t.id, t.status)}
                            className={`p-1.5 rounded-lg border text-xs transition-colors ${t.status === 'active'
                                ? 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              }`}
                            title={t.status === 'active' ? 'Suspend Tenant' : 'Activate Tenant'}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PLANS */}
        {activeTab === 'plans' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p) => (
              <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-white">{p.name}</h3>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      {p.price_etb} ETB / mo
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-6">{p.description}</p>

                  <ul className="space-y-3 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400" /> Up to {p.max_menu_items} Menu Items
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400" /> Up to {p.max_tables} Tables
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400" /> Up to {p.max_staff_accounts} Staff Accounts
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className={`w-4 h-4 ${p.delivery_enabled ? 'text-emerald-400' : 'text-slate-600'}`} />
                      Delivery System {p.delivery_enabled ? 'Enabled' : 'Disabled'}
                    </li>
                  </ul>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-800 text-center">
                  <span className="text-xs text-slate-500">ID: {p.id} • Active Plan</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Tenant Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <h3 className="text-lg font-bold text-white">Provision New Restaurant Tenant</h3>

            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Restaurant Name</label>
                <input
                  type="text"
                  required
                  value={newTenant.name}
                  onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                  placeholder="e.g. Skyline Bistro"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">URL Slug</label>
                <input
                  type="text"
                  required
                  value={newTenant.slug}
                  onChange={(e) => setNewTenant({ ...newTenant, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 font-mono"
                  placeholder="e.g. skyline-bistro"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Admin Email</label>
                <input
                  type="email"
                  required
                  value={newTenant.email}
                  onChange={(e) => setNewTenant({ ...newTenant, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                  placeholder="owner@skyline.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Admin Password</label>
                <input
                  type="password"
                  required
                  value={newTenant.admin_password}
                  onChange={(e) => setNewTenant({ ...newTenant, admin_password: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Subscription Plan</label>
                <select
                  value={newTenant.plan_id}
                  onChange={(e) => setNewTenant({ ...newTenant, plan_id: parseInt(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.price_etb} ETB/mo)</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-sm font-bold shadow-lg shadow-amber-500/20"
                >
                  Provision Tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
