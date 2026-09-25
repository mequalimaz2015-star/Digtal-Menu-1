import { useState, useEffect } from 'react'
import client from '../../api/client'
import { Users, Search, RefreshCw, Building2, Shield, ChevronDown } from 'lucide-react'

const ROLE_BADGES = {
  super_admin: { label: 'Super Admin', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  admin:       { label: 'Admin',       cls: 'bg-purple-500/15 text-purple-400 border-purple-500/25' },
  manager:     { label: 'Manager',     cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  barista:     { label: 'Barista',     cls: 'bg-pink-500/15 text-pink-400 border-pink-500/25' },
  kitchen:     { label: 'Kitchen',     cls: 'bg-green-500/15 text-green-400 border-green-500/25' },
  waiter:      { label: 'Waiter',      cls: 'bg-orange-500/15 text-orange-400 border-orange-500/25' },
  customer:    { label: 'Customer',    cls: 'bg-slate-500/15 text-slate-400 border-slate-500/25' },
}

export default function SAUsers() {
  const [users, setUsers] = useState([])
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [tenantFilter, setTenantFilter] = useState('all')

  const load = async () => {
    setLoading(true)
    try {
      const [uRes, tRes] = await Promise.all([
        client.get('/superadmin/users'),
        client.get('/superadmin/tenants'),
      ])
      setUsers(uRes.data || [])
      setTenants(tRes.data || [])
    } catch {
      setUsers([])
      setTenants([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    const matchTenant = tenantFilter === 'all' || String(u.tenant_id) === tenantFilter
    return matchSearch && matchRole && matchTenant
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">All Users</h2>
          <p className="text-sm text-slate-400 mt-0.5">Every user account across all restaurants on the platform</p>
        </div>
        <button onClick={load} className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: users.length },
          { label: 'Admins / Managers', value: users.filter(u => ['admin', 'manager'].includes(u.role)).length },
          { label: 'Kitchen / Waiters', value: users.filter(u => ['kitchen', 'waiter', 'barista'].includes(u.role)).length },
          { label: 'Customers', value: users.filter(u => u.role === 'customer').length },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-2xl font-extrabold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name or email..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
        <select
          value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
        >
          <option value="all">All Roles</option>
          {Object.entries(ROLE_BADGES).map(([r, b]) => (
            <option key={r} value={r}>{b.label}</option>
          ))}
        </select>
        <select
          value={tenantFilter} onChange={e => setTenantFilter(e.target.value)}
          className="px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
        >
          <option value="all">All Restaurants</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {/* Users table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-800/40 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-4">User</th>
                <th className="px-5 py-4">Role</th>
                <th className="px-5 py-4">Restaurant</th>
                <th className="px-5 py-4">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan={4} className="px-5 py-4"><div className="h-8 bg-slate-800 rounded-lg animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-16 text-slate-500">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No users found</p>
                  </td>
                </tr>
              ) : filtered.map(u => {
                const badge = ROLE_BADGES[u.role] || ROLE_BADGES.customer
                const tenant = tenants.find(t => t.id === u.tenant_id)
                return (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-amber-400 text-sm uppercase">
                          {(u.name || u.email || '?')[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{u.name || '—'}</p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${badge.cls}`}>
                        {u.role === 'super_admin' && <Shield className="w-3 h-3" />}
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {tenant ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          {tenant.name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">Platform</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        <div className="px-5 py-3 border-t border-slate-800 text-xs text-slate-500">
          Showing {filtered.length} of {users.length} users
        </div>
      </div>
    </div>
  )
}
