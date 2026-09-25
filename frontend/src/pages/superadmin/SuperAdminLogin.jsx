import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import { Shield, Lock, Mail, Server } from 'lucide-react'

export default function SuperAdminLogin() {
  const [email, setEmail] = useState('superadmin@platform.com')
  const [password, setPassword] = useState('superadmin123')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await client.post('/auth/login', { email, password })
      if (res.data.user?.role !== 'super_admin') {
        setError('Access denied: This login is restricted to Super Admin platform owners only.')
        setLoading(false)
        return
      }

      localStorage.setItem('superadmin_token', res.data.access_token)
      localStorage.setItem('token', res.data.access_token)
      localStorage.setItem('superadmin_user', JSON.stringify(res.data.user))
      localStorage.setItem('user', JSON.stringify(res.data.user))
      // Store as admin-user too so the axios interceptor reads the correct role/tenant
      localStorage.setItem('admin-user', JSON.stringify(res.data.user))
      // Super admin has no tenant — clear any stale tenant_slug from a previous restaurant session
      localStorage.removeItem('tenant_slug')

      navigate('/superadmin')
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid Super Admin credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center mb-8">
          <div className="inline-flex p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-4">
            <Shield className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">SaaS Platform Console</h1>
          <p className="text-sm text-slate-400 mt-1">Super Admin Authentication Portal</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Platform Admin Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-800/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                placeholder="superadmin@platform.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-800/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In to Super Admin Console'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
          <span className="text-xs text-slate-500 inline-flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5" /> Multi-Tenant Platform Engine v2.0
          </span>
        </div>
      </div>
    </div>
  )
}
