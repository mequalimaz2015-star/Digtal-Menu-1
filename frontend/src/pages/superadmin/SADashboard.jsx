import { useState, useEffect } from 'react'
import client from '../../api/client'
import {
  Building2, DollarSign, Activity, Users, TrendingUp, AlertTriangle,
  CheckCircle, Clock, Zap, ArrowUpRight, RefreshCw, ShoppingBag, Layers
} from 'lucide-react'

function StatCard({ label, value, sub, icon: Icon, color = 'amber', trend }) {
  const colors = {
    amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   text: 'text-amber-400'   },
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
    blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    text: 'text-blue-400'    },
    purple:  { bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  text: 'text-purple-400'  },
    rose:    { bg: 'bg-rose-500/10',    border: 'border-rose-500/20',    text: 'text-rose-400'    },
  }
  const c = colors[color] || colors.amber
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
          <h3 className="text-3xl font-extrabold text-white">{value ?? '—'}</h3>
        </div>
        <div className={`p-3 rounded-xl border ${c.bg} ${c.border} ${c.text}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-1 text-xs font-semibold text-emerald-400">
          <TrendingUp className="w-3.5 h-3.5" /> +{trend}% this month
        </div>
      )}
    </div>
  )
}

function RecentTenantRow({ tenant }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-slate-800/60 last:border-0 hover:bg-slate-800/20 px-2 rounded-xl transition-colors">
      <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-amber-400 text-sm flex-shrink-0">
        {tenant.name?.[0] || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{tenant.name}</p>
        <p className="text-xs text-slate-500 truncate">/r/{tenant.slug}</p>
      </div>
      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
        tenant.status === 'active'
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
          : 'bg-red-500/15 text-red-400 border border-red-500/25'
      }`}>
        {tenant.status}
      </span>
      <span className="text-xs text-slate-500 hidden sm:block">{tenant.plan_name || 'Trial'}</span>
    </div>
  )
}

export default function SADashboard() {
  const [metrics, setMetrics] = useState(null)
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [mRes, tRes] = await Promise.all([
        client.get('/superadmin/dashboard'),
        client.get('/superadmin/tenants'),
      ])
      setMetrics(mRes.data)
      setTenants(tRes.data.slice(0, 6))
    } catch (err) {
      console.error(err)
      // Use mock data when DB is offline
      setMetrics({
        total_tenants: 1,
        active_tenants: 1,
        trial_tenants: 0,
        suspended_tenants: 0,
        total_orders_platform: 0,
        total_revenue_platform: 0,
        mrr_etb: 0,
      })
      setTenants([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Platform Overview</h2>
          <p className="text-sm text-slate-400 mt-0.5">Real-time metrics across all registered restaurants</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Restaurants"
          value={metrics?.total_tenants ?? 0}
          sub={`${metrics?.active_tenants ?? 0} active • ${metrics?.trial_tenants ?? 0} trial`}
          icon={Building2}
          color="blue"
        />
        <StatCard
          label="Monthly Revenue"
          value={`${(metrics?.mrr_etb ?? 0).toLocaleString()} ETB`}
          sub="Recurring subscription MRR"
          icon={DollarSign}
          color="emerald"
          trend={8}
        />
        <StatCard
          label="Platform Orders"
          value={(metrics?.total_orders_platform ?? 0).toLocaleString()}
          sub="Total orders processed"
          icon={ShoppingBag}
          color="amber"
        />
        <StatCard
          label="Gross Sales Volume"
          value={`${(metrics?.total_revenue_platform ?? 0).toLocaleString()} ETB`}
          sub="Cumulative GMV"
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* Status summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-xl font-black text-white">{metrics?.active_tenants ?? 0}</p>
            <p className="text-xs text-slate-400">Active Tenants</p>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-xl font-black text-white">{metrics?.trial_tenants ?? 0}</p>
            <p className="text-xs text-slate-400">On Free Trial</p>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-xl font-black text-white">{metrics?.suspended_tenants ?? 0}</p>
            <p className="text-xs text-slate-400">Suspended</p>
          </div>
        </div>
      </div>

      {/* Recent tenants */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-400" /> Recent Restaurants
          </h3>
          <a
            href="/superadmin/tenants"
            className="text-xs text-amber-400 hover:underline flex items-center gap-1"
          >
            View all <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No tenants registered yet</p>
            <a href="/superadmin/tenants" className="mt-3 inline-block text-xs text-amber-400 hover:underline">
              + Provision first restaurant
            </a>
          </div>
        ) : (
          <div>
            {tenants.map(t => <RecentTenantRow key={t.id} tenant={t} />)}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Add Restaurant', href: '/superadmin/tenants', icon: Building2, color: 'from-amber-500 to-orange-600' },
          { label: 'Manage Plans', href: '/superadmin/plans', icon: Layers, color: 'from-purple-500 to-violet-600' },
          { label: 'View Revenue', href: '/superadmin/revenue', icon: DollarSign, color: 'from-emerald-500 to-teal-600' },
          { label: 'Activity Log', href: '/superadmin/activity', icon: Activity, color: 'from-blue-500 to-cyan-600' },
        ].map(a => (
          <a
            key={a.label}
            href={a.href}
            className={`flex flex-col items-center justify-center gap-3 p-5 rounded-2xl bg-gradient-to-br ${a.color} text-white font-semibold text-sm shadow-lg hover:scale-105 active:scale-100 transition-transform`}
          >
            <a.icon className="w-6 h-6" />
            {a.label}
          </a>
        ))}
      </div>
    </div>
  )
}


