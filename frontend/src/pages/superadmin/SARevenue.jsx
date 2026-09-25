import { useState, useEffect } from 'react'
import client from '../../api/client'
import { DollarSign, TrendingUp, RefreshCw, Building2, CheckCircle, Clock, AlertTriangle } from 'lucide-react'

function RevenueBar({ label, value, max, color = '#f59e0b' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300 font-medium">{label}</span>
        <span className="text-white font-bold">{value.toLocaleString()} ETB</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export default function SARevenue() {
  const [tenants, setTenants] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [mRes, tRes] = await Promise.all([
        client.get('/superadmin/dashboard'),
        client.get('/superadmin/tenants'),
      ])
      setMetrics(mRes.data)
      setTenants(tRes.data)
    } catch {
      setMetrics({ mrr_etb: 0, total_revenue_platform: 0, total_tenants: 0, active_tenants: 0 })
      setTenants([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Mock monthly revenue data for chart
  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
  const mockRevenue = [1200, 2400, 3100, 3800, 4900, metrics?.mrr_etb || 0]
  const maxRev = Math.max(...mockRevenue, 1)

  // Per-tenant subscription revenues
  const tenantRevenues = tenants.map(t => ({
    name: t.name,
    plan_name: t.plan_name || 'Trial',
    price: t.plan_price || 0,
    status: t.status,
  }))
  const totalMRR = tenantRevenues.reduce((s, t) => s + (t.status === 'active' ? t.price : 0), 0)
  const maxPrice = Math.max(...tenantRevenues.map(t => t.price), 1)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Revenue & Billing</h2>
          <p className="text-sm text-slate-400 mt-0.5">Subscription revenue overview and financial metrics</p>
        </div>
        <button onClick={load} className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Monthly Recurring Revenue', value: `${(metrics?.mrr_etb || totalMRR).toLocaleString()} ETB`, icon: DollarSign, color: 'emerald' },
          { label: 'Annual Projection', value: `${((metrics?.mrr_etb || totalMRR) * 12).toLocaleString()} ETB`, icon: TrendingUp, color: 'amber' },
          { label: 'Active Paying Tenants', value: tenantRevenues.filter(t => t.status === 'active' && t.price > 0).length, icon: Building2, color: 'blue' },
          { label: 'Gross Sales (All Tenants)', value: `${(metrics?.total_revenue_platform || 0).toLocaleString()} ETB`, icon: CheckCircle, color: 'purple' },
        ].map(m => (
          <div key={m.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{m.label}</p>
            <p className="text-2xl font-extrabold text-white">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MRR Bar Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="font-bold text-white mb-5 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" /> MRR Trend (6 months)
          </h3>
          <div className="flex items-end justify-between gap-2 h-40">
            {months.map((m, i) => {
              const h = maxRev > 0 ? Math.round((mockRevenue[i] / maxRev) * 100) : 0
              const isLast = i === months.length - 1
              return (
                <div key={m} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-xs text-slate-400 font-medium">{mockRevenue[i].toLocaleString()}</span>
                  <div
                    className={`w-full rounded-t-lg transition-all duration-700 ${isLast ? 'bg-amber-500' : 'bg-slate-700'}`}
                    style={{ height: `${h}%`, minHeight: '4px' }}
                  />
                  <span className="text-xs text-slate-500">{m}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Per-tenant breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="font-bold text-white mb-5 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-400" /> Per-Restaurant Revenue
          </h3>
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => <div key={i} className="h-8 bg-slate-800 rounded-lg animate-pulse" />)}
            </div>
          ) : tenantRevenues.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No tenants yet</p>
          ) : (
            <div className="space-y-4">
              {tenantRevenues.map((t, i) => (
                <RevenueBar
                  key={i}
                  label={`${t.name} (${t.plan_name})`}
                  value={t.price}
                  max={maxPrice}
                  color={t.status === 'active' ? '#f59e0b' : '#64748b'}
                />
              ))}
              <div className="pt-3 border-t border-slate-800 flex justify-between text-sm">
                <span className="text-slate-400">Total MRR</span>
                <span className="font-black text-emerald-400">{totalMRR.toLocaleString()} ETB</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Billing status table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="font-bold text-white mb-5">Billing Status by Restaurant</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 pr-6">Restaurant</th>
                <th className="py-3 pr-6">Plan</th>
                <th className="py-3 pr-6">Monthly Fee</th>
                <th className="py-3 pr-6">Status</th>
                <th className="py-3">Annual Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {tenantRevenues.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-slate-500">No data</td></tr>
              ) : tenantRevenues.map((t, i) => (
                <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 pr-6 font-semibold text-white">{t.name}</td>
                  <td className="py-3.5 pr-6">
                    <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs text-slate-300">{t.plan_name}</span>
                  </td>
                  <td className="py-3.5 pr-6 font-bold text-white">{t.price.toLocaleString()} ETB</td>
                  <td className="py-3.5 pr-6">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                      t.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                        : t.status === 'trial'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                        : 'bg-red-500/15 text-red-400 border border-red-500/25'
                    }`}>
                      {t.status === 'active' ? <CheckCircle className="w-3 h-3" /> : t.status === 'trial' ? <Clock className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3.5 text-slate-300">{(t.price * 12).toLocaleString()} ETB</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
