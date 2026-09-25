import { useState, useEffect } from 'react'
import client from '../../api/client'
import { Activity, Search, RefreshCw, Filter } from 'lucide-react'

const ACTION_COLORS = {
  create:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  update:  'bg-blue-500/15 text-blue-400 border-blue-500/25',
  delete:  'bg-red-500/15 text-red-400 border-red-500/25',
  suspend: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  login:   'bg-purple-500/15 text-purple-400 border-purple-500/25',
  impersonate: 'bg-pink-500/15 text-pink-400 border-pink-500/25',
}

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return d.toLocaleDateString()
}

// Mock activity data for when DB is offline
const MOCK_ACTIVITY = [
  { id: 1, action: 'create', target_type: 'tenant', target_name: 'ABC Restaurant', actor_email: 'superadmin@platform.com', created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 2, action: 'login',  target_type: 'auth',   target_name: 'Super Admin Login', actor_email: 'superadmin@platform.com', created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 3, action: 'update', target_type: 'plan',   target_name: 'Starter Plan', actor_email: 'superadmin@platform.com', created_at: new Date(Date.now() - 86400000).toISOString() },
]

export default function SAActivity() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')

  const load = async () => {
    setLoading(true)
    try {
      const res = await client.get('/superadmin/audit-logs')
      setLogs(res.data || [])
    } catch {
      setLogs(MOCK_ACTIVITY)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = logs.filter(l => {
    const matchSearch = !search ||
      l.target_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.actor_email?.toLowerCase().includes(search.toLowerCase())
    const matchAction = actionFilter === 'all' || l.action === actionFilter
    return matchSearch && matchAction
  })

  const actions = [...new Set(logs.map(l => l.action))]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Activity Log</h2>
          <p className="text-sm text-slate-400 mt-0.5">Audit trail of all platform admin actions</p>
        </div>
        <button onClick={load} className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search actor, target..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', ...actions].map(a => (
            <button
              key={a}
              onClick={() => setActionFilter(a)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold capitalize transition-colors ${
                actionFilter === a
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-slate-800 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No activity logs found</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-800" />

            <div className="space-y-1">
              {filtered.map((log, i) => {
                const colorCls = ACTION_COLORS[log.action] || 'bg-slate-500/15 text-slate-400 border-slate-500/25'
                return (
                  <div key={log.id || i} className="flex items-start gap-4 py-3 hover:bg-slate-800/20 px-3 rounded-xl transition-colors">
                    {/* Dot */}
                    <div className={`relative z-10 w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 text-xs font-bold uppercase ${colorCls}`}>
                      {(log.action || '?')[0]}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white text-sm">{log.target_name || log.target_type}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${colorCls}`}>
                          {log.action}
                        </span>
                        {log.target_type && (
                          <span className="text-xs text-slate-500 capitalize">{log.target_type}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        by <span className="text-slate-400">{log.actor_email || 'System'}</span>
                      </p>
                    </div>

                    {/* Time */}
                    <span className="text-xs text-slate-500 whitespace-nowrap pt-1.5">{timeAgo(log.created_at)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
