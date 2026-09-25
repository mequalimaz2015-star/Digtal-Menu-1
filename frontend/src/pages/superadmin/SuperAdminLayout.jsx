import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  Shield, LayoutDashboard, Building2, Layers, Users, DollarSign,
  Settings, LogOut, Menu, X, ChevronRight, Activity,
  FileText, Bell, ExternalLink, Globe, Zap
} from 'lucide-react'

const NAV = [
  {
    label: 'Platform',
    items: [
      { to: '/superadmin', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/superadmin/tenants', icon: Building2, label: 'Restaurants' },
      { to: '/superadmin/plans', icon: Layers, label: 'Subscription Plans' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/superadmin/revenue', icon: DollarSign, label: 'Revenue & Billing' },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/superadmin/users', icon: Users, label: 'All Users' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/superadmin/activity', icon: Activity, label: 'Activity Log' },
      { to: '/superadmin/announcements', icon: Bell, label: 'Announcements' },
      { to: '/superadmin/settings', icon: Settings, label: 'Platform Settings' },
    ],
  },
]

export default function SuperAdminLayout() {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const user = (() => { try { return JSON.parse(localStorage.getItem('superadmin_user') || '{}') } catch { return {} } })()

  const handleLogout = () => {
    localStorage.removeItem('superadmin_token')
    localStorage.removeItem('superadmin_user')
    localStorage.removeItem('token')
    localStorage.removeItem('admin-user')
    localStorage.removeItem('user')
    localStorage.removeItem('tenant_slug')
    navigate('/superadmin/login')
  }

  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-100 font-sans">
      {/* ── Sidebar ── */}
      <aside className={`
        fixed lg:sticky top-0 h-screen w-64 z-50 flex-shrink-0 flex flex-col
        bg-slate-900 border-r border-slate-800
        transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 flex-shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-black text-white text-sm leading-tight truncate">Noble's Ecom Admin</h1>
            <span className="text-xs text-amber-400 font-semibold">Platform Owner</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-slate-500 hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {NAV.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 mb-2">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150
                      ${isActive
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }
                    `}
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-70" />}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="p-3 border-t border-slate-800 space-y-1">
          <a
            href="/register-tenant"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <ExternalLink className="w-4 h-4" /> Tenant Sign-Up Page
          </a>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
        />
      )}

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-slate-900/80 border-b border-slate-800 backdrop-blur-md h-16 flex items-center px-5 gap-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-800"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          {/* Status indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Platform Healthy
          </div>

          {/* User */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-white">{user?.name || 'Super Admin'}</p>
              <span className="text-xs text-amber-400 font-semibold">Platform Owner</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-slate-950 font-bold text-sm shadow-md shadow-amber-500/20">
              {(user?.name || 'S').charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-5 lg:p-7 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
