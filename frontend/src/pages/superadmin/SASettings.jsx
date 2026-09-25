import { useState, useEffect } from 'react'
import client from '../../api/client'
import { Settings, Save, RefreshCw, Globe, Shield, DollarSign, Server, Eye, EyeOff } from 'lucide-react'

export default function SASettings() {
  const [form, setForm] = useState({
    platform_name: 'MenuSaaS Platform',
    support_email: 'support@menusaas.com',
    default_currency: 'ETB',
    trial_days: 14,
    chapa_secret_key: '',
    telebirr_app_id: '',
    jwt_secret: '',
    smtp_host: '',
    smtp_user: '',
    smtp_pass: '',
    maintenance_mode: false,
    allow_new_registrations: true,
    max_tenants: 100,
  })
  const [saved, setSaved] = useState(false)
  const [showSecrets, setShowSecrets] = useState(false)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      await client.put('/superadmin/settings', form)
    } catch { /* offline */ }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const InputRow = ({ label, fieldKey, type = 'text', placeholder = '', help }) => (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type={type}
        value={form[fieldKey]}
        onChange={e => set(fieldKey, type === 'number' ? +e.target.value : e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
      />
      {help && <p className="text-xs text-slate-600 mt-1">{help}</p>}
    </div>
  )

  const ToggleRow = ({ label, fieldKey, help }) => (
    <div className="flex items-center justify-between py-3 border-b border-slate-800 last:border-0">
      <div>
        <p className="text-sm font-semibold text-slate-300">{label}</p>
        {help && <p className="text-xs text-slate-500 mt-0.5">{help}</p>}
      </div>
      <div
        onClick={() => set(fieldKey, !form[fieldKey])}
        className={`relative w-12 h-6 rounded-full cursor-pointer border transition-colors ${
          form[fieldKey] ? 'bg-amber-500 border-amber-500' : 'bg-slate-700 border-slate-600'
        }`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form[fieldKey] ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </div>
    </div>
  )

  const Section = ({ icon: Icon, title, children }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
      <h3 className="font-bold text-white flex items-center gap-2.5 text-base">
        <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Icon className="w-4 h-4 text-amber-400" />
        </div>
        {title}
      </h3>
      {children}
    </div>
  )

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Platform Settings</h2>
          <p className="text-sm text-slate-400 mt-0.5">Global configuration for the SaaS platform</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* General */}
        <Section icon={Globe} title="General">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputRow label="Platform Name" fieldKey="platform_name" placeholder="MenuSaaS" />
            <InputRow label="Support Email" fieldKey="support_email" type="email" placeholder="support@yourplatform.com" />
            <InputRow label="Default Currency" fieldKey="default_currency" placeholder="ETB" help="ISO currency code for billing" />
            <InputRow label="Trial Period (days)" fieldKey="trial_days" type="number" placeholder="14" />
            <InputRow label="Max Tenants" fieldKey="max_tenants" type="number" placeholder="100" help="Set 0 for unlimited" />
          </div>
        </Section>

        {/* Toggles */}
        <Section icon={Settings} title="Platform Controls">
          <ToggleRow label="Maintenance Mode" fieldKey="maintenance_mode" help="When ON, only super admin can log in" />
          <ToggleRow label="Allow New Registrations" fieldKey="allow_new_registrations" help="Allow restaurants to self-register" />
        </Section>

        {/* Payment Gateways */}
        <Section icon={DollarSign} title="Payment Gateways">
          <div className="flex items-center justify-end mb-2">
            <button type="button" onClick={() => setShowSecrets(!showSecrets)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
              {showSecrets ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showSecrets ? 'Hide' : 'Show'} secrets
            </button>
          </div>
          <div className="space-y-4">
            <InputRow label="Chapa Secret Key" fieldKey="chapa_secret_key"
              type={showSecrets ? 'text' : 'password'} placeholder="sk_live_..." />
            <InputRow label="TeleBirr App ID" fieldKey="telebirr_app_id"
              type={showSecrets ? 'text' : 'password'} placeholder="App ID from TeleBirr developer portal" />
          </div>
        </Section>

        {/* Email / SMTP */}
        <Section icon={Server} title="Email / SMTP">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputRow label="SMTP Host" fieldKey="smtp_host" placeholder="smtp.sendgrid.net" />
            <InputRow label="SMTP User" fieldKey="smtp_user" placeholder="apikey" />
            <div className="sm:col-span-2">
              <InputRow label="SMTP Password" fieldKey="smtp_pass"
                type={showSecrets ? 'text' : 'password'} placeholder="••••••••" />
            </div>
          </div>
        </Section>

        {/* Security */}
        <Section icon={Shield} title="Security">
          <InputRow label="JWT Secret (override)" fieldKey="jwt_secret"
            type={showSecrets ? 'text' : 'password'}
            placeholder="Leave empty to use env variable"
            help="Only set this to override the server .env JWT_SECRET" />
        </Section>

        {/* Save */}
        <button
          type="submit"
          className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 font-bold rounded-2xl text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saved ? '✓ Settings Saved!' : 'Save All Settings'}
        </button>
      </form>
    </div>
  )
}
