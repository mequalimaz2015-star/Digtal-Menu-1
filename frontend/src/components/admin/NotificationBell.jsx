import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiBell, FiX, FiCheck, FiTrash2, FiPackage } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { useOrderStore } from '../../store/useOrderStore'
import { io } from 'socket.io-client'
import toast from 'react-hot-toast'

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

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
  const { notifications, unreadCount, markAllRead, markNotificationRead, clearNotifications, addNotification } = useOrderStore()

  // Listen for new orders from ALL devices via Socket.io (cross-device)
  // AND from same-device other tabs via localStorage
  useEffect(() => {
    // Resolve the admin's numeric tenant ID from localStorage admin-user or token
    const getAdminTenantId = () => {
      try {
        const user = JSON.parse(localStorage.getItem('admin-user') || '{}')
        if (user.tenant_id) return user.tenant_id
        // Fallback: decode from JWT
        const token = localStorage.getItem('token')
        if (token && token !== 'demo-admin-token') {
          const parts = token.split('.')
          if (parts.length === 3) {
            const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/')
            const payload = JSON.parse(atob(padded + '=='.slice((padded.length % 4) || 4)))
            return payload.tenant_id || null
          }
        }
      } catch (_) {}
      return null
    }

    // ── Socket.io: fires ONLY for this tenant's orders via room ──────────────
    const socket = io('/', { transports: ['websocket', 'polling'] })

    socket.on('connect', () => {
      const tenantId = getAdminTenantId()
      if (tenantId) {
        // Join tenant room so we only receive events for our own restaurant
        socket.emit('join_tenant', { tenantId })
      }
    })

    const handleNewOrder = (order) => {
      // Play notification sound
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.value = 880; osc.type = 'sine'
        gain.gain.setValueAtTime(0.4, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
        osc.start(); osc.stop(ctx.currentTime + 0.8)
      } catch (_) {}

      const tableNum   = order.table_number || order.tableNumber || '?'
      const total      = (order.grand_total || order.grandTotal || 0).toFixed(0)
      const itemsCount = (order.items || []).length
      const customer   = order.customer_name || order.customerName || 'Guest'
      const orderRef   = order.order_ref || order.id?.toString() || `ORD-${Date.now()}`

      // Push into the persistent notification store so the bell badge updates
      addNotification({
        id: `notif-${orderRef}-${Date.now()}`,
        type: 'new_order',
        title: '🛎️ New Order!',
        message: `Table ${tableNum} · ${total} ETB · ${itemsCount} item(s) · ${customer}`,
        orderId: orderRef,
        read: false,
        createdAt: order.created_at || order.createdAt || new Date().toISOString(),
      })

      toast.custom((t) => (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20 }}
          className={`${t.visible ? 'opacity-100' : 'opacity-0'} bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border-2 border-orange-400 p-4 flex items-start gap-3 max-w-sm`}
        >
          <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
            🛎️
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-gray-900 dark:text-white">New Order!</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Table {tableNum} · {total} ETB
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {itemsCount} items · {customer}
            </p>
          </div>
          <button onClick={() => toast.dismiss(t.id)} className="text-gray-400 hover:text-gray-600 mt-0.5">
            <FiX size={16} />
          </button>
        </motion.div>
      ), { duration: 8000, position: 'top-right' })
    }

    socket.on('new_order', handleNewOrder)
    // tenant-scoped room means this `new_order` event already only arrives for our restaurant

    // ── localStorage: fires only in other same-device tabs ───────────────────
    const handleStorage = (e) => {
      if (e.key === 'new-order-event' && e.newValue) {
        try {
          const { order } = JSON.parse(e.newValue)
          handleNewOrder(order)
        } catch (_) {}
      }
    }
    window.addEventListener('storage', handleStorage)

    return () => {
      socket.disconnect()
      window.removeEventListener('storage', handleStorage)
    }
  }, [])
  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => { setOpen(!open); if (!open && unreadCount > 0) markAllRead() }}
        className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
      >
        <FiBell size={20} />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key={unreadCount}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
        {/* Pulse ring when unread */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-400 rounded-full animate-ping opacity-60" />
        )}
      </motion.button>
      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 w-96 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center gap-2">
                <FiBell size={16} className="text-orange-500" />
                <span className="font-bold text-gray-900 dark:text-white text-sm">Notifications</span>
                {notifications.length > 0 && (
                  <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-bold px-2 py-0.5 rounded-full">
                    {notifications.length}
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                {notifications.length > 0 && (
                  <>
                    <button
                      onClick={markAllRead}
                      title="Mark all read"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      <FiCheck size={14} />
                    </button>
                    <button
                      onClick={clearNotifications}
                      title="Clear all"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* List */}
            <div className="max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-3xl mb-3">🔔</div>
                  <p className="font-semibold text-gray-700 dark:text-gray-300 text-sm">All caught up!</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">New orders will appear here</p>
                </div>
              ) : (
                notifications.map((n, idx) => (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors ${!n.read ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}`}
                    onClick={() => {
                      markNotificationRead(n.id)
                      navigate('/admin/orders')
                      setOpen(false)
                    }}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${n.type === 'new_order' ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                      {n.type === 'new_order' ? '🛎️' : '✅'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900 dark:text-white text-sm">{n.title}</p>
                        {!n.read && <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => { navigate('/admin/orders'); setOpen(false) }}
                  className="w-full text-center text-sm text-orange-500 font-semibold hover:text-orange-600 py-1"
                >
                  View all orders →
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
