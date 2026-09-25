import { useState, useEffect } from 'react'
import client from '../../api/client'
import { Layers, Plus, CheckCircle, Edit3, Trash2, RefreshCw, X, Truck } from 'lucide-react'

function PlanModal({ isOpen, onClose, onSave, initial }) {
  const blank = {
    name: '', price_etb: 0, description: '', max_menu_items: 50,
    max_tables: 10, max_staff_accounts: 5, delivery_enabled: false,
    analytics_enabled: false, custom_branding: false
  }
  const [form, setForm] = useState(initial || blank)
  useEffect(() => { setForm(initial || blank) }, [initial])
  if (!isOpen) return null

  const toggle = (key) => setForm(f => ({ ...f, [key]: !f[key] }))
  const isEdit = !!initial?.id

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">{isEdit ? 'Edit Plan' : 'Create Subscription Plan'}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Plan Name *</label>
              <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                placeholder="e.g. Starter, Pro, Enterprise" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Price (ETB/mo) *</label>
              <input required type="number" min="0" value={form.price_etb} onChange={e => setForm({...form, price_etb: +e.target.value})}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Max Menu Items</label>
              <input type="number" min="1" value={form.max_menu_items} onChange={e => setForm({...form, max_menu_items: +e.target.value})}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Max Tables</label>
              <input type="number" min="1" value={form.max_tables} onChange={e => setForm({...form, max_tables: +e.target.value})}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Max Staff Accounts</label>
              <input type="number" min="1" value={form.max_staff_accounts} onChange={e => setForm({...form, max_staff_accounts: +e.target.value})}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Description</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 resize-none"
                placeholder="Plan description for restaurant owners..." />
            </div>
            <div className="col-span-2 space-y-3">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Features</label>
              {[
                { key: 'delivery_enabled', label: 'Delivery System' },
                { key: 'analytics_enabled', label: 'Advanced Analytics' },
                { key: 'custom_branding', label: 'Custom Branding' },
              ].map(f => (
                <label key={f.key} className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => toggle(f.key)}
                    className={`relative w-10 h-5.5 rounded-full border transition-colors flex-shrink-0 cursor-pointer ${
                      form[f.key] ? 'bg-amber-500 border-amber-500' : 'bg-slate-700 border-slate-600'
                    }`}
                    style={{ height: '22px' }}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form[f.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm text-slate-300">{f.label}</span>
                  {form[f.key] && <CheckCircle className="w-4 h-4 text-amber-400" />}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium">Cancel</button>
            <button type="submit" className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-sm font-bold shadow-lg shadow-amber-500/20">
              {isEdit ? 'Save Plan' : 'Create Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const PLAN_COLORS = [
  'from-slate-600 to-slate-700',
  'from-amber-500 to-orange-600',
  'from-purple-500 to-violet-600',
  'from-emerald-500 to-teal-600',
]

export default function SAPlans() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState({ open: false, initial: null })

  const load = async () => {
    setLoading(true)
    try {
      const res = await client.get('/superadmin/plans')
      setPlans(res.data)
    } catch {
      setPlans([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSave = async (form) => {
    try {
      if (form.id) {
        await client.put(`/superadmin/plans/${form.id}`, form)
      } else {
        await client.post('/superadmin/plans', form)
      }
      setModal({ open: false, initial: null })
      load()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save plan')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this plan? Tenants currently on it will be unaffected.')) return
    try {
      await client.delete(`/superadmin/plans/${id}`)
      load()
    } catch (err) {
      alert(err.response?.data?.error || 'Cannot delete plan')
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PlanModal
        isOpen={modal.open}
        onClose={() => setModal({ open: false, initial: null })}
        onSave={handleSave}
        initial={modal.initial}
      />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Subscription Plans</h2>
          <p className="text-sm text-slate-400 mt-0.5">Define pricing tiers and feature limits for restaurants</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setModal({ open: true, initial: null })}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm shadow-lg shadow-amber-500/20 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Plan
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => <div key={i} className="h-80 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />)}
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-24 text-slate-500">
          <Layers className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No plans created yet</p>
          <button onClick={() => setModal({ open: true, initial: null })}
            className="mt-4 px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-sm font-bold">
            Create first plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((p, idx) => (
            <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl hover:border-slate-700 transition-colors flex flex-col">
              {/* Plan header gradient */}
              <div className={`bg-gradient-to-r ${PLAN_COLORS[idx % PLAN_COLORS.length]} p-5`}>
                <h3 className="text-xl font-black text-white">{p.name}</h3>
                <p className="text-3xl font-extrabold text-white mt-1">
                  {p.price_etb.toLocaleString()} <span className="text-sm font-normal opacity-80">ETB/mo</span>
                </p>
              </div>

              {/* Features */}
              <div className="p-5 flex-1 space-y-3">
                {p.description && <p className="text-xs text-slate-400 leading-relaxed">{p.description}</p>}
                <ul className="space-y-2.5 text-sm text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    Up to <strong className="text-white">{p.max_menu_items}</strong> menu items
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    Up to <strong className="text-white">{p.max_tables}</strong> tables
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    Up to <strong className="text-white">{p.max_staff_accounts}</strong> staff accounts
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Truck className={`w-4 h-4 flex-shrink-0 ${p.delivery_enabled ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span className={p.delivery_enabled ? 'text-slate-300' : 'text-slate-600 line-through'}>
                      Delivery System
                    </span>
                  </li>
                  {p.analytics_enabled && (
                    <li className="flex items-center gap-2.5">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      Advanced Analytics
                    </li>
                  )}
                  {p.custom_branding && (
                    <li className="flex items-center gap-2.5">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      Custom Branding
                    </li>
                  )}
                </ul>
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-slate-800 flex gap-2">
                <button
                  onClick={() => setModal({ open: true, initial: p })}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 rounded-xl transition-colors"
                  title="Delete Plan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
