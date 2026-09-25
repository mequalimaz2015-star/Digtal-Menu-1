import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiHome, FiGrid, FiLayers, FiTag, FiTable, FiMaximize,
  FiShoppingCart, FiTruck, FiBarChart2, FiUsers,
  FiSettings, FiLogOut, FiMenu, FiX, FiChevronRight,
  FiExternalLink, FiStar, FiBell, FiMessageSquare,
} from 'react-icons/fi'
import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import useAppStore from '../../store/useAppStore'
import NotificationBell from '../../components/admin/NotificationBell'
import WaiterCallsMonitor from '../../components/admin/WaiterCallsMonitor'
import { useRestaurantStore } from '../../store/useRestaurantStore'
import { useMenuStore } from '../../store/useMenuStore'
import { useRole } from '../../hooks/useRole'

// ── Full nav definition — each item tagged with roles that can see it ─────────
const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/admin', icon: FiHome, label: 'Dashboard', end: true,
        roles: ['admin','manager','barista','kitchen','waiter'] },
    ],
  },
  {
    label: 'Menu Management',
    roles: ['admin','manager','barista'],          // whole group hidden for kitchen/waiter
    items: [
      { to: '/admin/categories', icon: FiGrid,   label: 'Categories' },
      { to: '/admin/menu-items', icon: FiLayers, label: 'Menu Items' },
      { to: '/admin/modifiers',  icon: FiTag,    label: 'Modifiers'  },
    ],
  },
  {
    label: 'Restaurant',
    roles: ['admin','manager','barista'],
    items: [
      { to: '/admin/tables',    icon: FiTable,   label: 'Tables'    },
      { to: '/admin/qr-codes',  icon: FiMaximize,label: 'QR Codes'  },
    ],
  },
  {
    label: 'Orders',
    items: [
      { to: '/admin/orders',  icon: FiShoppingCart, label: 'Orders',
        roles: ['admin','manager','barista','kitchen','waiter'] },
      { to: '/admin/kitchen', icon: FiTruck,         label: 'Kitchen Display',
        roles: ['admin','manager','barista','kitchen'] },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/reports',  icon: FiBarChart2,     label: 'Reports',
        roles: ['admin','manager','barista'] },
      { to: '/admin/reviews',  icon: FiStar,          label: 'Reviews',
        roles: ['admin','manager','barista','waiter'] },
      { to: '/admin/chat',     icon: FiMessageSquare, label: 'Chat Support',
        roles: ['admin','manager','barista','waiter'] },
      { to: '/admin/users',    icon: FiUsers,         label: 'Users',
        roles: ['admin'] },
      { to: '/admin/settings', icon: FiSettings,      label: 'Settings',
        roles: ['admin'] },
    ],
  },
]
// Role badge colors
const ROLE_BADGE = {
  admin:   { label: 'Admin',   icon: '👑', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  manager: { label: 'Manager', icon: '💼', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  barista: { label: 'Barista', icon: '☕', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  kitchen: { label: 'Kitchen', icon: '👨‍🍳', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  waiter:  { label: 'Waiter',  icon: '🛎️', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
}
export default function AdminLayout() {
  const navigate = useNavigate()
  const { darkMode, toggleDarkMode } = useAppStore()
  const { info } = useRestaurantStore()
  const { fetchAll } = useMenuStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [chatUnread, setChatUnread]   = useState(0)
  const { role, perms, user, canAccess } = useRole()
  const badge = ROLE_BADGE[role] || ROLE_BADGE.admin

  // Fetch tenant-scoped menu data fresh on every admin session mount
  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Listen for new chat messages to show unread badge in topbar
  useEffect(() => {
    const socket = io('/', { transports: ['websocket', 'polling'] })
    socket.on('chat_new_message', () => setChatUnread(n => n + 1))
    return () => socket.disconnect()
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('admin-user')
    // Clear tenant slug — also removes the tenant-namespaced menu store cache
    const slug = localStorage.getItem('tenant_slug') || 'default'
    localStorage.removeItem(`menu-store-${slug}`)
    localStorage.removeItem('menu-store')   // clean up old non-namespaced key
    localStorage.removeItem('tenant_slug')
    navigate('/admin/login')
  }

  // Filter nav groups and items based on current role
  const visibleGroups = NAV_GROUPS
    .filter(g => !g.roles || g.roles.includes(role))
    .map(g => ({
      ...g,
      items: g.items.filter(item => !item.roles || item.roles.includes(role)),
    }))
    .filter(g => g.items.length > 0)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
      {/* Waiter Calls Monitor — all roles hear the bell */}
      <WaiterCallsMonitor />

      {/* ── Sidebar ── */}
      <aside className={`
        fixed lg:sticky top-0 h-screen w-64 z-50 flex-shrink-0
        bg-white dark:bg-gray-900
        border-r border-gray-200 dark:border-gray-800
        flex flex-col transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo + role badge */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100 dark:border-gray-800">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-orange-200 dark:shadow-none flex-shrink-0">
            🍽️
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-black text-gray-900 dark:text-white text-sm leading-tight truncate">
              {info.name || 'ABC Restaurant'}
            </h1>
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full mt-0.5 ${badge.cls}`}>
              {badge.icon} {badge.label}
            </span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <FiX size={20} />
          </button>
        </div>

        {/* Nav — role-filtered */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {visibleGroups.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest px-3 mb-1">
                {group.label}
              </p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm
                    transition-all duration-150 mb-0.5
                    ${isActive
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-200 dark:shadow-orange-900/30'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                    }
                  `}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={17} />
                      <span className="flex-1">{item.label}</span>
                      {isActive && <FiChevronRight size={14} className="opacity-70" />}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800 space-y-1">
          {/* Waiter mode link — only for admin and waiter role */}
          {(role === 'admin' || role === 'waiter') && (
            <a href="/waiter" target="_blank" rel="noopener"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors">
              <FiBell size={17} /> Waiter Mode
            </a>
          )}
          <a
            href={info?.id && localStorage.getItem('tenant_slug') && localStorage.getItem('tenant_slug') !== 'abc-restaurant'
              ? `/r/${localStorage.getItem('tenant_slug')}/menu`
              : '/menu'}
            target="_blank" rel="noopener"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <FiExternalLink size={17} /> View Menu
          </a>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <FiLogOut size={17} /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 h-16 flex items-center px-5 gap-4">
          <button onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
            <FiMenu size={22} />
          </button>
          <div className="flex-1" />

          {/* Dark mode toggle */}
          <button onClick={toggleDarkMode}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            {darkMode ? '☀️' : '🌙'}
          </button>

          {/* Notification bell */}
          <NotificationBell />

          {/* Chat unread badge */}
          {chatUnread > 0 && (
            <button
              onClick={() => { navigate('/admin/chat'); setChatUnread(0) }}
              className="relative w-9 h-9 rounded-xl flex items-center justify-center text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              title="New chat messages"
            >
              <FiMessageSquare size={19} />
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow"
              >
                {chatUnread > 9 ? '9+' : chatUnread}
              </motion.span>
            </button>
          )}

          {/* User pill */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {user?.name || 'Staff'}
              </p>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                {badge.icon} {badge.label}
              </span>
            </div>
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md shadow-orange-200 dark:shadow-none">
              {(user?.name || 'A').charAt(0).toUpperCase()}
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
