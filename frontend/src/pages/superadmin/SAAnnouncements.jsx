import { useState, useEffect } from 'react'
import client from '../../api/client'
import { Bell, Plus, Trash2, RefreshCw, X, Megaphone, AlertTriangle, Info, CheckCircle } from 'lucide-react'

const TYPE_STYLES = {
  info:    { icon: Info,          cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25',    label: 'Info' },
  warning: { icon: AlertTriangle, cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25', label: 'Warning' },
  success: { icon: CheckCircle,   cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', label: 'Success' },
  promo:   { icon: Megaphone,     cls: 'bg-purple-500/15 text-purple-400 border-purple-500/25', label: 'Promo' },
}

const MOCK_ANNOUNCEMENTS = [
  { id: 1, type: 'info', title: 'Scheduled Maintenance', body: 'The platform will undergo maintenance on Oct 1 from 2-4 AM UTC.', created_at: new Date().toISOString() },
  { id: 2, type: 'promo', title: 'New Feature: Delivery Tracking', body: 'All Pro and Enterprise tenants now have live delivery tracking.', created_at: new Date(Date.now() - 86400000).toISOString() },
]

export default function SAAnnouncements() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ type: 'info', title: '', body: '' })

  const load = async () => {
    setLoading(true)
    try {
      const res = await client.get('/superadmin/announcements')
      setItems(res.data || [])
    } catch {
      setItems(MOCK_ANNOUNCEMENTS)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await client.post('/superadmin/announcements', form)
      setShowModal(false)
      setForm({ type: 'info', title: '', body: '' })
      load()
    } catch {
      // Offline demo: just append locally
      setItems(prev => [{ ...form, id: Date.now(), created_at: new Date().toISOString() }, ...prev])
      setShowModal(false)
      setForm({ type: 'info', title: '', body: '' })
    }
  }

  const handleDelete = async (id) => {
    try {
      await client.delete(`/superadmin/announcements/${id}`)
    } catch { /* offline */ }
    setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">New Announcement</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-300"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Type</label>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500">
                  {Object.entries(TYPE_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Title *</label>
                <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                  placeholder="Announcement title" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Message *</label>
                <textarea required rows={4} value={form.body} onChange={e => setForm({...form, body: e.target.value})}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 resize-none"
                  placeholder="Enter the announcement message sent to all restaurant owners..." />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-sm font-bold shadow-lg shadow-amber-500/20">Publish</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Announcements</h2>
          <p className="text-sm text-slate-400 mt-0.5">Publish platform-wide notices to all restaurant owners</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-amber-500/20 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Announcement
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-24 text-slate-500">
          <Bell className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No announcements yet</p>
          <button onClick={() => setShowModal(true)} className="mt-4 px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-sm font-bold">
            Create first announcement
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(item => {
            const t = TYPE_STYLES[item.type] || TYPE_STYLES.info
            const Icon = t.icon
            return (
              <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className={`p-2.5 rounded-xl border flex-shrink-0 ${t.cls}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-white">{item.title}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${t.cls}`}>{t.label}</span>
                      </div>
                      <p className="text-sm text-slate-400 leading-relaxed">{item.body}</p>
                      <p className="text-xs text-slate-600 mt-2">
                        {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 rounded-xl opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
