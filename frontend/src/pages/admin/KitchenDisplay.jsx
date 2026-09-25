import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiClock, FiCheck, FiRefreshCw } from 'react-icons/fi'
import toast from 'react-hot-toast'
import client from '../../api/client'
const statusFlow = { new: 'preparing', preparing: 'ready', ready: 'served' }

const colorsMap = {
  new: 'border-blue-400 bg-blue-50 dark:bg-blue-900/10',
  preparing: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10',
  ready: 'border-green-400 bg-green-50 dark:bg-green-900/10',
}

const columnDef = [
  { id: 'new',       label: '🔵 New Orders', color: 'text-blue-600 dark:text-blue-400',     ring: 'ring-blue-200 dark:ring-blue-800' },
  { id: 'preparing', label: '🟡 Preparing',  color: 'text-yellow-600 dark:text-yellow-400', ring: 'ring-yellow-200 dark:ring-yellow-800' },
  { id: 'ready',     label: '🟢 Ready',      color: 'text-green-600 dark:text-green-400',   ring: 'ring-green-200 dark:ring-green-800' },
]

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

export default function KitchenDisplay() {
  const [orders, setOrders] = useState([])
  const intervalRef = useRef(null)
  const prevCountRef = useRef(0)

  const fetchOrders = useCallback(async (silent = false) => {
    try {
      const res = await client.get('/orders')
      const data = res.data

      const active = data
        .filter(o => ['new', 'preparing', 'ready'].includes(o.status))
        .map(o => ({
          id: o.order_ref || String(o.id),
          dbId: o.id,
          tableNumber: o.table_number,
          customerName: o.customer_name,
          notes: o.notes,
          status: o.status,
          orderType:       o.order_type || 'dine_in',
          pickupNumber:    o.pickup_number || '',
          pickupTime:      o.pickup_time || '',
          deliveryAddress: o.delivery_address || '',
          deliveryLat:     o.delivery_lat || null,
          deliveryLng:     o.delivery_lng || null,
          grandTotal: o.grand_total,
          createdAt: o.created_at,
          estimatedTime: o.estimated_time,
          items: (o.items || []).map(i => ({
            name: i.menu_item_name,
            qty: i.quantity,
            modifiers: i.modifiers,
            specialInstructions: i.special_instructions,
          })),
        }))

      if (active.length > prevCountRef.current && prevCountRef.current > 0 && !silent) {
        toast('🛎️ New order in kitchen!', {
          style: { fontWeight: 'bold', border: '2px solid #f97316', borderRadius: '12px' },
        })
      }
      prevCountRef.current = active.length
      setOrders(active)
    } catch (_) {}
  }, [])
  useEffect(() => {
    fetchOrders()
    intervalRef.current = setInterval(() => fetchOrders(true), 5000)
    return () => clearInterval(intervalRef.current)
  }, [fetchOrders])
  useEffect(() => {
    const handler = (e) => { if (e.key === 'new-order-event') fetchOrders(true) }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [fetchOrders])

  const advance = async (order) => {
    const next = statusFlow[order.status]
    if (!next) return
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: next } : o))
    try {
      await client.put(`/orders/${order.dbId}/status`, { status: next })
      toast.success(`Order #${order.id.slice(-4)} → ${next}`, { icon: '👨‍🍳' })
      if (next === 'served') setOrders(prev => prev.filter(o => o.id !== order.id))
    } catch {
      fetchOrders(true)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🍳 Kitchen Display</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {orders.length} active orders
            <span className="ml-2 text-xs text-green-500">● Live (auto-refresh 5s)</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(() => {
            try {
              const u = JSON.parse(localStorage.getItem('admin-user') || '{}')
              return u?.name ? (
                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm">
                  <span className="text-xl">👨‍🍳</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{u.name}</span>
                </div>
              ) : null
            } catch { return null }
          })()}
          <button onClick={() => fetchOrders()} className="btn-primary">
            <FiRefreshCw size={16} /> Refresh
          </button>
          <button
            onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('admin-user'); localStorage.removeItem('tenant_slug'); window.location.href = '/admin/login' }}
            className="text-xs text-red-500 font-semibold px-3 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border border-red-200 dark:border-red-900"
          >
            Logout
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-6xl mb-4">👨‍🍳</div>
          <h2 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">Kitchen is clear!</h2>
          <p className="text-gray-500 dark:text-gray-400">Waiting for new orders from customers...</p>
          <div className="flex gap-2 mt-4">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="w-2.5 h-2.5 bg-orange-400 rounded-full"
                animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {columnDef.map(col => {
            const colOrders = orders.filter(o => o.status === col.id)
            return (
              <div key={col.id}>
                <div className={`flex items-center justify-between mb-3 ${col.color}`}>
                  <span className="font-black text-base">{col.label}</span>
                  <span className={`bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-full w-8 h-8 flex items-center justify-center text-sm font-black shadow ring-2 ${col.ring}`}>
                    {colOrders.length}
                  </span>
                </div>

                <div className="space-y-3 min-h-[120px]">
                  <AnimatePresence>
                    {colOrders.map(order => (
                      <motion.div
                        key={order.id}
                        layout
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, x: 20 }}
                        transition={{ type: 'spring', damping: 20 }}
                        className={`rounded-2xl border-2 p-4 ${colorsMap[order.status]}`}
                      >
                        {/* Order header */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="font-black text-gray-900 dark:text-white text-base">
                                #{order.id.slice(-6)}
                              </p>
                              {order.orderType === 'takeaway' && (
                                <span className="text-[10px] font-black px-2 py-0.5 bg-blue-500 text-white rounded-full">
                                  🛍️ TAKEAWAY
                                </span>
                              )}
                            </div>
                            {order.orderType === 'takeaway' ? (
                              <>
                                {order.pickupNumber && (
                                  <p className="text-base font-black text-blue-600 dark:text-blue-400">
                                    {order.pickupNumber}
                                  </p>
                                )}
                                {order.pickupTime && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">⏰ {order.pickupTime}</p>
                                )}
                                {order.deliveryAddress && (
                                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-start gap-1">
                                    <span className="flex-shrink-0">📍</span>
                                    <span className="line-clamp-2">{order.deliveryAddress}</span>
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                                🪑 Table {order.tableNumber}
                              </p>
                            )}
                            {order.customerName && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">{order.customerName}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded-full shadow">
                              <FiClock size={11} />
                              {timeAgo(order.createdAt)}
                            </div>
                            <span className="text-xs font-bold text-orange-500">{order.grandTotal?.toFixed(0)} ETB</span>
                          </div>
                        </div>

                        {/* Items */}
                        <div className="space-y-1.5 mb-3">
                          {order.items?.map((item, i) => (
                            <div key={i} className="flex items-start gap-2 bg-white/70 dark:bg-gray-800/70 rounded-xl p-2.5">
                              <span className="font-black text-orange-500 text-sm leading-none w-6 flex-shrink-0">
                                ×{item.qty}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">{item.name}</p>
                                {item.modifiers && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.modifiers}</p>}
                                {item.specialInstructions && (
                                  <p className="text-xs text-orange-500 italic mt-0.5">📝 {item.specialInstructions}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Notes */}
                        {order.notes && (
                          <div className="bg-orange-100 dark:bg-orange-900/20 rounded-xl px-3 py-2 mb-3">
                            <p className="text-xs text-orange-700 dark:text-orange-300 font-semibold">
                              💬 {order.notes}
                            </p>
                          </div>
                        )}

                        {/* Action button */}
                        {statusFlow[order.status] && (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => advance(order)}
                            className="w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90 shadow-md"
                          >
                            <FiCheck size={15} strokeWidth={2.5} />
                            Mark as {statusFlow[order.status]}
                          </motion.button>
                        )}
                        {order.status === 'ready' && (
                          <div className="text-center text-xs font-bold text-green-600 dark:text-green-400 mt-1">
                            ✅ Ready to serve!
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {colOrders.length === 0 && (
                    <div className="text-center py-10 text-gray-300 dark:text-gray-700 text-sm border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
