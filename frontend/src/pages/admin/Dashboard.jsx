import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  FiShoppingCart, FiDollarSign, FiClock, FiArrowUp, FiArrowDown,
  FiRefreshCw, FiCheckCircle, FiAlertCircle, FiTrendingUp,
} from 'react-icons/fi'
import { MdTableRestaurant } from 'react-icons/md'
import { useRole } from '../../hooks/useRole'
import client from '../../api/client'

function timeAgo(iso) {
  if (!iso) return ''
  let d = new Date(iso)
  let diff = Math.floor((Date.now() - d) / 1000)
  if (diff < -60) {
    d = new Date(d.getTime() + (d.getTimezoneOffset() * 60000))
    diff = Math.floor((Date.now() - d) / 1000)
  }
  if (diff < 0) diff = 0
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString()
}

const statusColors = {
  new:       'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  preparing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  ready:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  served:    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { role, perms, user } = useRole()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchOrders = useCallback(async () => {
    try {
      const res = await client.get('/orders')
      const data = res.data
      if (!Array.isArray(data)) return

      const mapped = data.map(o => ({
        id: o.order_ref || String(o.id),
        dbId: o.id,
        tableNumber: o.table_number,
        customerName: o.customer_name,
        status: o.status,
        grandTotal: o.grand_total || 0,
        createdAt: o.created_at || o.createdAt,
        items: (o.items || []).map(i => ({
          name: i.menu_item_name || i.name,
          qty: i.quantity || i.qty,
        })),
      }))
      setOrders(mapped)
      setLastRefresh(new Date())
    } catch (_) {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchOrders()
    const iv = setInterval(fetchOrders, 8000)
    return () => clearInterval(iv)
  }, [fetchOrders])

  // Live computed stats
  const today = new Date().toDateString()
  const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === today)
  const todayRevenue = todayOrders.reduce((s, o) => s + (o.grandTotal || 0), 0)
  const activeOrders = orders.filter(o => ['new', 'preparing', 'ready'].includes(o.status))
  const newOrders = orders.filter(o => o.status === 'new')
  const readyOrders = orders.filter(o => o.status === 'ready')
  const servedToday = todayOrders.filter(o => o.status === 'served').length

  // Unique tables occupied today
  const activeTables = new Set(activeOrders.map(o => o.tableNumber)).size

  const stats = [
    {
      label: "Today's Revenue",
      value: `${todayRevenue.toLocaleString()} ETB`,
      icon: FiDollarSign, color: 'bg-green-500',
      sub: `${todayOrders.length} orders today`,
      trend: todayRevenue > 0 ? '+live' : null, up: true,
    },
    {
      label: 'Active Orders',
      value: activeOrders.length,
      icon: FiShoppingCart, color: 'bg-blue-500',
      sub: `${newOrders.length} new · ${readyOrders.length} ready`,
      alert: newOrders.length > 0,
    },
    {
      label: 'Occupied Tables',
      value: `${activeTables}`,
      icon: MdTableRestaurant, color: 'bg-purple-500',
      sub: 'tables currently active',
    },
    {
      label: 'Served Today',
      value: servedToday,
      icon: FiCheckCircle, color: 'bg-orange-500',
      sub: 'orders completed',
      trend: servedToday > 0 ? `+${servedToday}` : null, up: true,
    },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Dashboard
            {user?.name && (
              <span className="ml-2 text-base font-normal text-gray-500 dark:text-gray-400">
                · Welcome, {user.name}
              </span>
            )}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            Live overview · refreshed {timeAgo(lastRefresh)}
          </p>
        </div>
        <button onClick={fetchOrders} className="btn-primary">
          <FiRefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Alert banner for new orders */}
      {newOrders.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-2xl px-5 py-3.5 mb-6 cursor-pointer"
          onClick={() => navigate('/admin/orders')}
        >
          <FiAlertCircle className="text-orange-500 flex-shrink-0" size={20} />
          <div className="flex-1">
            <p className="font-bold text-orange-700 dark:text-orange-300 text-sm">
              🛎️ {newOrders.length} new order{newOrders.length > 1 ? 's' : ''} waiting!
            </p>
            <p className="text-xs text-orange-600 dark:text-orange-400">Click to view and manage orders</p>
          </div>
          <span className="text-orange-500 text-sm font-bold">View →</span>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
            className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-11 h-11 ${stat.color} rounded-xl flex items-center justify-center text-white shadow`}>
                <stat.icon size={20} />
              </div>
              {stat.trend && (
                <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${stat.up ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600'}`}>
                  {stat.up ? <FiArrowUp size={10} /> : <FiArrowDown size={10} />} {stat.trend}
                </span>
              )}
              {stat.alert && (
                <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 animate-pulse">
                  ● NEW
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {loading ? '—' : stat.value}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
            {stat.sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{stat.sub}</p>}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Live Active Orders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="xl:col-span-2 bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 dark:text-white">🔴 Live Active Orders</h2>
            <button onClick={() => navigate('/admin/orders')} className="text-orange-500 text-xs font-bold hover:underline">View All →</button>
          </div>
          {loading ? (
            <div className="py-8 text-center text-gray-400">Loading...</div>
          ) : activeOrders.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <p className="text-3xl mb-2">✅</p>
              <p className="font-semibold">All orders served! Waiting for new ones...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left pb-3 font-semibold">Order</th>
                    <th className="text-left pb-3 font-semibold">Table</th>
                    <th className="text-left pb-3 font-semibold">Items</th>
                    <th className="text-left pb-3 font-semibold">Total</th>
                    <th className="text-left pb-3 font-semibold">Status</th>
                    <th className="text-left pb-3 font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {activeOrders.slice(0, 8).map(order => (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => navigate('/admin/orders')}>
                      <td className="py-3 font-bold text-gray-900 dark:text-white">#{order.id?.slice(-6)}</td>
                      <td className="py-3">
                        <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-lg text-xs font-bold">
                          T{order.tableNumber}
                        </span>
                      </td>
                      <td className="py-3 text-gray-600 dark:text-gray-400 max-w-[180px] truncate text-xs">
                        {order.items?.map(i => `${i.qty}× ${i.name}`).join(', ')}
                      </td>
                      <td className="py-3 font-bold text-gray-900 dark:text-white">{Number(order.grandTotal).toFixed(0)} ETB</td>
                      <td className="py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusColors[order.status]}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 text-gray-400 text-xs">{timeAgo(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Right Panel: Quick Stats + Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="space-y-4"
        >
          {/* Today Summary */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
            <h2 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FiTrendingUp className="text-orange-500" /> Today's Summary
            </h2>
            <div className="space-y-3">
              {[
                { label: 'New Orders', value: newOrders.length, color: 'text-blue-600' },
                { label: 'Preparing', value: orders.filter(o => o.status === 'preparing').length, color: 'text-yellow-600' },
                { label: 'Ready to Serve', value: readyOrders.length, color: 'text-green-600' },
                { label: 'Served', value: servedToday, color: 'text-gray-600' },
                { label: 'Cancelled', value: todayOrders.filter(o => o.status === 'cancelled').length, color: 'text-red-500' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{item.label}</span>
                  <span className={`text-sm font-black ${item.color}`}>{loading ? '—' : item.value}</span>
                </div>
              ))}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-3 flex justify-between">
                <span className="text-sm font-bold text-gray-900 dark:text-white">Total Revenue</span>
                <span className="text-sm font-black text-orange-500">{todayRevenue.toLocaleString()} ETB</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
            <h2 className="font-bold text-gray-900 dark:text-white mb-4">⚡ Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '📦 Orders',     path: '/admin/orders',     color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',      roles: ['admin','manager','barista','kitchen','waiter'] },
                { label: '👨‍🍳 Kitchen',  path: '/admin/kitchen',    color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400', roles: ['admin','manager','barista','kitchen'] },
                { label: '📊 Reports',    path: '/admin/reports',    color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',    roles: ['admin','manager','barista'] },
                { label: '🍽️ Menu',       path: '/admin/menu-items', color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400', roles: ['admin','manager','barista'] },
                { label: '🏷️ Categories', path: '/admin/categories', color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400', roles: ['admin','manager','barista'] },
                { label: '🪑 Tables',     path: '/admin/tables',     color: 'bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400',         roles: ['admin','manager','barista'] },
                { label: '⭐ Reviews',    path: '/admin/reviews',    color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400',  roles: ['admin','manager','barista','waiter'] },
                { label: '👥 Users',      path: '/admin/users',      color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400',  roles: ['admin'] },
                { label: '⚙️ Settings',   path: '/admin/settings',   color: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',           roles: ['admin'] },
              ].filter(a => a.roles.includes(role)).map(action => (
                <button key={action.path} onClick={() => navigate(action.path)}
                  className={`p-3 rounded-xl text-xs font-bold text-left transition-all hover:scale-105 ${action.color}`}>
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
