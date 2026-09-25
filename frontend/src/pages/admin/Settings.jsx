import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FiSave, FiRefreshCw, FiZap, FiCheck, FiShield, FiAlertTriangle, FiCreditCard } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { useRestaurantStore } from '../../store/useRestaurantStore'
import client from '../../api/client'

export default function Settings() {
  const { info, fetchRestaurant, saveRestaurant } = useRestaurantStore()
  const token = localStorage.getItem('token')

  const [tenant, setTenant] = useState(null)
  const [plans, setPlans] = useState([])
  const [activeTab, setActiveTab] = useState('general')

  const [form, setForm] = useState({
    name: info.name || 'ABC Restaurant',
    nameAm: info.nameAm || 'ኤቢሲ ምግብ ቤት',
    tagline: info.tagline || 'Fine Dining & Fast Delivery',
    address: info.address || 'Bole Road, Addis Ababa, Ethiopia',
    phone: info.phone || '+251 91 859 2028',
    wifi: info.wifi || 'ABCRest@2024',
    hours: info.hours || 'Mon–Sun: 7:00 AM – 11:00 PM',
    vatRate: Math.round((info.vatRate ?? 0.15) * 100),
    serviceCharge: Math.round((info.serviceChargeRate ?? 0.10) * 100),
    currency: info.currency || 'ETB',
  })
  const [saving, setSaving] = useState(false)
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => {
    fetchTenantProfile()
  }, [])

  const fetchTenantProfile = async () => {
    try {
      const res = await client.get('/tenants/current')
      setTenant(res.data)

      const pRes = await client.get('/superadmin/plans')
      setPlans(pRes.data)
    } catch (err) {
      console.warn('Tenant profile fetch fallback:', err.message)
    }
  }

  // Sync form when store info loads from API
  useEffect(() => {
    setForm({
      name: info.name || '',
      nameAm: info.nameAm || '',
      tagline: info.tagline || '',
      address: info.address || '',
      phone: info.phone || '',
      wifi: info.wifi || '',
      hours: info.hours || '',
      vatRate: Math.round((info.vatRate ?? 0.15) * 100),
      serviceCharge: Math.round((info.serviceChargeRate ?? 0.10) * 100),
      currency: info.currency || 'ETB',
    })
  }, [info])

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Restaurant name is required'); return }
    setSaving(true)
    const ok = await saveRestaurant(form, token)
    setSaving(false)
    if (ok) {
      toast.success('✅ Settings saved & applied everywhere!')
    } else {
      toast.success('✅ Settings saved locally')
    }
  }

  const handleRefresh = async () => {
    await fetchRestaurant()
    await fetchTenantProfile()
    toast.success('Refreshed settings & subscription status')
  }

  const handleUpgradePlan = async (planId) => {
    setUpgrading(true)
    try {
      const res = await client.post('/tenants/subscription/checkout', { plan_id: planId })
      toast.success('Redirecting to Chapa payment portal...')
      window.location.href = res.data.checkout_url
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to initiate upgrade')
    } finally {
      setUpgrading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings & SaaS Plan</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Configure your restaurant and manage your subscription</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRefresh} className="btn-secondary flex items-center gap-2">
            <FiRefreshCw size={16} /> Refresh
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving
              ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full" />
              : <FiSave size={18} />
            }
            Save Settings
          </button>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex gap-3 border-b border-gray-200 dark:border-gray-800 pb-3 mb-6">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'general'
              ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
          }`}
        >
          General & Taxes
        </button>

        <button
          onClick={() => setActiveTab('subscription')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'subscription'
              ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
          }`}
        >
          <FiZap size={16} /> Subscription & Limits
        </button>
      </div>

      {/* TAB 1: GENERAL SETTINGS */}
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card space-y-4">
            <h2 className="font-bold text-gray-900 dark:text-white text-lg mb-4">🏪 Restaurant Profile</h2>
            <div><label className="label">Name (English)</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" /></div>
            <div><label className="label">Name (Amharic)</label><input value={form.nameAm} onChange={e => setForm({ ...form, nameAm: e.target.value })} className="input-field" /></div>
            <div><label className="label">Tagline</label><input value={form.tagline} onChange={e => setForm({ ...form, tagline: e.target.value })} className="input-field" /></div>
            <div><label className="label">Address</label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="input-field" /></div>
            <div><label className="label">Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field" /></div>
            <div><label className="label">WiFi Password</label><input value={form.wifi} onChange={e => setForm({ ...form, wifi: e.target.value })} className="input-field" /></div>
            <div><label className="label">Working Hours</label><input value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} className="input-field" /></div>
          </div>

          <div className="card space-y-4">
            <h2 className="font-bold text-gray-900 dark:text-white text-lg mb-4">💰 Billing & Order Tax Settings</h2>
            <div><label className="label">VAT Rate (%)</label><input type="number" min="0" max="100" value={form.vatRate} onChange={e => setForm({ ...form, vatRate: parseFloat(e.target.value) || 0 })} className="input-field" /><p className="text-xs text-gray-400 mt-1">Applied to all dine-in and delivery orders</p></div>
            <div><label className="label">Service Charge (%)</label><input type="number" min="0" max="100" value={form.serviceCharge} onChange={e => setForm({ ...form, serviceCharge: parseFloat(e.target.value) || 0 })} className="input-field" /></div>
            <div><label className="label">Currency</label><select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="input-field"><option value="ETB">🇪🇹 ETB – Ethiopian Birr</option><option value="USD">🇺🇸 USD – US Dollar</option></select></div>

            <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Order Receipt Preview</h3>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Subtotal</span><span>1,000.00 {form.currency}</span></div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>VAT ({form.vatRate}%)</span><span>{(1000 * form.vatRate / 100).toFixed(2)} {form.currency}</span></div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Service ({form.serviceCharge}%)</span><span>{(1000 * form.serviceCharge / 100).toFixed(2)} {form.currency}</span></div>
                <div className="flex justify-between font-black text-orange-500 border-t border-gray-200 dark:border-gray-700 pt-2"><span>Total</span><span>{(1000 + 1000 * form.vatRate / 100 + 1000 * form.serviceCharge / 100).toFixed(2)} {form.currency}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SUBSCRIPTION & PLAN LIMITS */}
      {activeTab === 'subscription' && tenant && (
        <div className="space-y-6">
          {/* Active Plan Banner */}
          <div className="card bg-gradient-to-r from-slate-900 to-gray-900 border-orange-500/30 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 bg-orange-500 text-slate-950 rounded-full text-xs font-black uppercase tracking-wider">
                  {tenant.plan_name || 'Pro SaaS Plan'}
                </span>
                <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                  <FiCheck /> Active Subscription
                </span>
              </div>
              <h2 className="text-2xl font-bold">{tenant.name} SaaS Membership</h2>
              <p className="text-xs text-gray-400 mt-1">
                Your menu URL slug: <code className="text-orange-400 font-mono">/r/{tenant.slug}</code>
              </p>
            </div>

            <div className="text-right">
              <div className="text-3xl font-extrabold text-orange-400">
                {tenant.plan_price || 3500} <span className="text-sm font-normal text-gray-400">ETB / month</span>
              </div>
            </div>
          </div>

          {/* Plan Usage Counters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="card p-5 border border-gray-100 dark:border-gray-800">
              <div className="flex justify-between text-sm text-gray-500 mb-2">
                <span>Menu Items Usage</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {tenant.current_menu_items} / {tenant.max_menu_items || 30}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-orange-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((tenant.current_menu_items || 0) / (tenant.max_menu_items || 30)) * 100)}%` }}
                />
              </div>
            </div>

            <div className="card p-5 border border-gray-100 dark:border-gray-800">
              <div className="flex justify-between text-sm text-gray-500 mb-2">
                <span>Tables Usage</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {tenant.current_tables} / {tenant.max_tables || 10}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((tenant.current_tables || 0) / (tenant.max_tables || 10)) * 100)}%` }}
                />
              </div>
            </div>

            <div className="card p-5 border border-gray-100 dark:border-gray-800">
              <div className="flex justify-between text-sm text-gray-500 mb-2">
                <span>Staff Accounts</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {tenant.current_staff} / {tenant.max_staff_accounts || 5}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((tenant.current_staff || 0) / (tenant.max_staff_accounts || 5)) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Available Subscription Plans for Upgrade */}
          <div className="card p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Upgrade Subscription Plan</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((p) => {
                const isCurrent = tenant.subscription_plan_id === p.id
                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                      isCurrent
                        ? 'border-orange-500 bg-orange-500/5 dark:bg-orange-500/10'
                        : 'border-gray-200 dark:border-gray-800 hover:border-gray-400'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-bold text-gray-900 dark:text-white text-base">{p.name}</h4>
                        {isCurrent && (
                          <span className="px-2.5 py-0.5 bg-orange-500 text-white rounded-full text-xs font-bold">Current</span>
                        )}
                      </div>
                      <div className="text-2xl font-black text-orange-500 mb-4">
                        {p.price_etb} <span className="text-xs font-normal text-gray-500">ETB/mo</span>
                      </div>
                      <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                        <li className="flex items-center gap-1.5"><FiCheck className="text-emerald-500" /> Up to {p.max_menu_items} Items</li>
                        <li className="flex items-center gap-1.5"><FiCheck className="text-emerald-500" /> Up to {p.max_tables} Tables</li>
                        <li className="flex items-center gap-1.5"><FiCheck className="text-emerald-500" /> {p.delivery_enabled ? 'Delivery System Included' : 'No Delivery'}</li>
                      </ul>
                    </div>

                    <button
                      onClick={() => handleUpgradePlan(p.id)}
                      disabled={isCurrent || upgrading}
                      className={`mt-6 w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        isCurrent
                          ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-default'
                          : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20'
                      }`}
                    >
                      <FiCreditCard /> {isCurrent ? 'Active Plan' : `Upgrade to ${p.name}`}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
