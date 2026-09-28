import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { io } from 'socket.io-client'
import { motion, AnimatePresence } from 'framer-motion'
import { useOrderStore } from '../../store/useOrderStore'
import useCartStore from '../../store/useCartStore'
import client from '../../api/client'
import toast from 'react-hot-toast'
import { FiBell, FiCheckCircle, FiVolume2, FiX } from 'react-icons/fi'

const statusConfig = {
  new: { label: 'Order Placed', labelAm: 'ትእዛዝ ተቀብሏል', icon: '📋', color: 'from-blue-500 to-indigo-600', sound: 'new' },
  preparing: { label: 'Preparing', labelAm: 'በማዘጋጀት ላይ', icon: '👨‍🍳', color: 'from-amber-500 to-orange-600', sound: 'preparing' },
  ready: { label: 'Ready!', labelAm: 'ዝግጁ ነው!', icon: '✅', color: 'from-emerald-500 to-teal-600', sound: 'ready' },
  served: { label: 'Served', labelAm: 'ተመግቧል', icon: '🍽️', color: 'from-purple-500 to-pink-600', sound: 'served' },
  cancelled: { label: 'Cancelled', labelAm: 'ተሰርዟል', icon: '❌', color: 'from-red-500 to-rose-600', sound: 'cancelled' },
}

// ── Audio & Vibration Helper ───────────────────────────────────────────────────
function playStatusSound(soundType = 'ready') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()

    const playTone = (freq, duration, delay = 0, type = 'sine', vol = 0.5) => {
      setTimeout(() => {
        try {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = type
          osc.frequency.setValueAtTime(freq, ctx.currentTime)
          gain.gain.setValueAtTime(vol, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start()
          osc.stop(ctx.currentTime + duration)
        } catch (_) { }
      }, delay)
    }

    if (soundType === 'ready') {
      // High-energy 4-tone ascending fanfare (C5, E5, G5, C6)
      playTone(523.25, 0.25, 0, 'triangle', 0.6)
      playTone(659.25, 0.25, 150, 'triangle', 0.6)
      playTone(783.99, 0.25, 300, 'triangle', 0.7)
      playTone(1046.50, 0.6, 450, 'sine', 0.8)
    } else if (soundType === 'served') {
      // Pleasant double chime (G5, E5)
      playTone(783.99, 0.3, 0, 'sine', 0.5)
      playTone(659.25, 0.4, 200, 'sine', 0.6)
    } else if (soundType === 'preparing') {
      // Soft warm double tone (E5, G5)
      playTone(659.25, 0.2, 0, 'sine', 0.4)
      playTone(783.99, 0.3, 150, 'sine', 0.5)
    }
  } catch (_) { }

  // Trigger mobile vibration pattern
  if ('vibrate' in navigator) {
    try {
      if (soundType === 'ready') {
        navigator.vibrate([300, 100, 300, 100, 500])
      } else {
        navigator.vibrate([200, 100, 200])
      }
    } catch (_) { }
  }
}

// ── Web Push System Notification Helper ────────────────────────────────────────
function sendSystemNotification(title, body, icon = '🍽️') {
  if (!('Notification' in window)) return

  const notify = () => {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'order-status-update',
        renotify: true,
        requireInteraction: true,
      })
    } catch (_) { }
  }

  if (Notification.permission === 'granted') {
    notify()
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') notify()
    })
  }
}

/**
 * OrderStatusMonitor Component
 * Real-time WebSocket + background polling + System Push Notification + Sound + Pop-up Modal
 */
export default function OrderStatusMonitor() {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const tableNumber = useCartStore(s => s.tableNumber)
  const { orders, fetchOrders } = useOrderStore()

  const [activePopup, setActivePopup] = useState(null)
  const [activeWaiterPopup, setActiveWaiterPopup] = useState(null)
  const [notificationGranted, setNotificationGranted] = useState(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  )

  const prevStatusesRef = useRef({})
  const hasNotifiedRef = useRef({})

  // Filter customer's active orders
  const lastOrder = orders?.filter(o => o.phone)?.at(0)
  const customerPhone = lastOrder?.phone || null
  const myOrders = (orders || []).filter(o =>
    customerPhone ? o.phone === customerPhone : String(o.tableNumber) === String(tableNumber)
  )

  // Request browser notification permission automatically on load
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          setNotificationGranted(permission === 'granted')
        })
      }
    }
  }, [])

  // Process status update & trigger alerts
  const handleStatusChange = (orderId, newStatus, orderData = {}) => {
    const key = `${orderId}-${newStatus}`
    if (hasNotifiedRef.current[key]) return
    hasNotifiedRef.current[key] = true

    const cfg = statusConfig[newStatus] || statusConfig.new
    const statusLabel = language === 'am' ? cfg.labelAm : cfg.label
    const orderRef = orderData.order_ref || orderData.orderRef || `#${String(orderId).slice(-4)}`
    const tbl = orderData.table_number || orderData.tableNumber || tableNumber

    // 1. Play Sound & Vibration
    playStatusSound(cfg.sound)

    // 2. Send System OS Notification (Works even when app is minimized/screen locked!)
    const title = `${cfg.icon} Order ${statusLabel}! (${orderRef})`
    const body = tbl
      ? `Table #${tbl}: Your order status changed to ${statusLabel}.`
      : `Your order status changed to ${statusLabel}.`
    sendSystemNotification(title, body, cfg.icon)

    // 3. Display In-App Pop-Up Modal
    setActivePopup({
      orderId,
      orderRef,
      status: newStatus,
      tableNumber: tbl,
      cfg,
      statusLabel,
      customerName: orderData.customer_name || orderData.customerName || '',
    })

    // 4. Toast Notification
    toast.custom((tItem) => (
      <div className={`flex items-center gap-3 bg-gray-900 text-white px-5 py-4 rounded-2xl shadow-2xl border border-gray-800 ${tItem.visible ? 'animate-enter' : 'animate-leave'}`}>
        <span className="text-3xl">{cfg.icon}</span>
        <div>
          <p className="font-extrabold text-sm">{title}</p>
          <p className="text-xs text-gray-300">{body}</p>
        </div>
      </div>
    ), { duration: 8000 })
  }
  // Socket.io Real-Time Listener & Polling Backup
  useEffect(() => {
    // 1. Connect Socket.io client
    const socket = io('/', { transports: ['websocket', 'polling'] })

    socket.on('connect', () => {
      console.log('⚡ OrderStatusMonitor socket connected:', socket.id)
    })
    
    socket.on('waiter_call_assigned', (call) => {
      // Check if this assignment belongs to the customer's current table
      if (String(call.tableNumber) === String(tableNumber)) {
        playStatusSound('ready')
        
        const title = `🤵 Waiter Assigned!`
        const body = `${call.waiterName || 'A waiter'} is on their way to Table #${tableNumber}.`
        sendSystemNotification(title, body, '🤵')
        
        toast.custom((tItem) => (
          <div className={`flex items-center gap-3 bg-indigo-900 text-white px-5 py-4 rounded-2xl shadow-2xl border border-indigo-500 font-bold ${tItem.visible ? 'animate-enter' : 'animate-leave'}`}>
            <span className="text-3xl animate-bounce">🤵</span>
            <div>
              <p className="text-base">{title}</p>
              <p className="text-xs text-indigo-200 font-normal">{body}</p>
            </div>
          </div>
        ), { duration: 8000 })
        
        setActiveWaiterPopup(call)
      }
    })

    socket.on('order_status_updated', (updatedOrder) => {
      if (!updatedOrder) return

      // Get all order refs this customer placed (stored in sessionStorage)
      let customerOrderRefs = []
      try {
        const stored = sessionStorage.getItem('customer_order_refs')
        customerOrderRefs = stored ? JSON.parse(stored) : []
      } catch (_) {}

      // Also check in-memory myOrders (may work if same browser session)
      const updatedRef = updatedOrder.order_ref || String(updatedOrder.id)
      const isMyOrder = (
        customerOrderRefs.includes(updatedRef) ||
        myOrders.some(o =>
          String(o.id) === String(updatedOrder.id) ||
          String(o.id) === updatedRef ||
          o.orderRef === updatedRef
        ) ||
        // Also match by table number as fallback
        (tableNumber && String(updatedOrder.table_number) === String(tableNumber))
      )

      if (isMyOrder) {
        const prev = prevStatusesRef.current[updatedRef]
        if (prev !== updatedOrder.status) {
          handleStatusChange(updatedRef, updatedOrder.status, updatedOrder)
        }
        prevStatusesRef.current[updatedRef] = updatedOrder.status
      }
    })

    socket.on('new_order', () => { /* no-op for customers */ })

    // 2. Background polling — poll the customer's own orders directly
    const pollInterval = setInterval(async () => {
      // Get order refs from sessionStorage
      let customerOrderRefs = []
      try {
        const stored = sessionStorage.getItem('customer_order_refs')
        customerOrderRefs = stored ? JSON.parse(stored) : []
      } catch (_) {}

      // Also include in-memory active orders
      const activeFromStore = myOrders.filter(o => !['served', 'cancelled'].includes(o.status))
      const allRefs = Array.from(new Set([
        ...customerOrderRefs,
        ...activeFromStore.map(o => o.id)
      ]))

      for (const orderRef of allRefs) {
        // Skip already-completed orders
        const prevStatus = prevStatusesRef.current[orderRef]
        if (['served', 'cancelled'].includes(prevStatus)) continue

        try {
          const res = await client.get(`/orders/${orderRef}`)
          const updated = res.data
          if (!updated) continue
          const newStatus = updated.status
          
          if (prevStatus && prevStatus !== newStatus) {
            handleStatusChange(orderRef, newStatus, updated)
          }
          prevStatusesRef.current[orderRef] = newStatus
        } catch (_) {}
      }
    }, 4000)

    // Seed initial status cache from in-memory orders
    myOrders.forEach(o => {
      if (!prevStatusesRef.current[o.id]) {
        prevStatusesRef.current[o.id] = o.status
      }
    })

    return () => {
      socket.disconnect()
      clearInterval(pollInterval)
    }
  }, [myOrders, tableNumber])

  return (
    <>
      {/* Pop-Up Modal Alert when Order Status Changes (Ready / Served / Preparing) */}
      <AnimatePresence>
        {activePopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-gray-800 text-center overflow-hidden"
            >
              {/* Background Glow */}
              <div className={`absolute -top-20 -left-20 w-40 h-40 rounded-full bg-gradient-to-br ${activePopup.cfg.color} opacity-20 blur-3xl`} />
              <div className={`absolute -bottom-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br ${activePopup.cfg.color} opacity-20 blur-3xl`} />

              {/* Close Button */}
              <button
                onClick={() => setActivePopup(null)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <FiX size={20} />
              </button>

              {/* Status Graphic & Icon */}
              <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-tr from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center text-4xl shadow-inner mb-4 animate-bounce">
                {activePopup.cfg.icon}
              </div>

              {/* Header */}
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-1">
                {activePopup.statusLabel}!
              </h2>

              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
                Order <span className="font-bold text-orange-500">{activePopup.orderRef}</span>
                {activePopup.tableNumber ? ` · Table ${activePopup.tableNumber}` : ''}
              </p>

              {/* Message Box */}
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 border border-orange-200/60 dark:border-orange-900/50 rounded-2xl p-4 mb-6 text-left">
                <p className="text-xs text-orange-800 dark:text-orange-300 font-semibold leading-relaxed">
                  {activePopup.status === 'ready' && '🎉 Your delicious food is hot, freshly prepared and ready for pickup/serving!'}
                  {activePopup.status === 'served' && '🍽️ Your order has been served to your table. Bon Appétit!'}
                  {activePopup.status === 'preparing' && '👨‍🍳 The kitchen team has started cooking your meal!'}
                  {['new', 'cancelled'].includes(activePopup.status) && `Status updated to ${activePopup.statusLabel}.`}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => {
                    playStatusSound(activePopup.cfg.sound)
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors mb-2"
                >
                  <FiVolume2 size={16} /> Replay Alert Sound
                </button>

                <button
                  onClick={() => setActivePopup(null)}
                  className={`w-full py-3.5 px-6 rounded-2xl text-white font-bold text-sm bg-gradient-to-r ${activePopup.cfg.color} shadow-lg hover:opacity-95 transition-all transform active:scale-95`}
                >
                  Awesome, Got It!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pop-Up Modal Alert when Waiter is Assigned */}
      <AnimatePresence>
        {activeWaiterPopup && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-2xl border border-indigo-100 dark:border-indigo-900 text-center overflow-hidden"
            >
              {/* Background Glow */}
              <div className="absolute -top-20 -left-20 w-40 h-40 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 opacity-20 blur-3xl" />
              <div className="absolute -bottom-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 opacity-20 blur-3xl" />

              {/* Close Button */}
              <button
                onClick={() => setActiveWaiterPopup(null)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <FiX size={20} />
              </button>

              {/* Status Graphic & Icon */}
              <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-50 to-blue-100 dark:from-indigo-900/40 dark:to-blue-900/40 flex items-center justify-center text-4xl shadow-inner mb-4 animate-bounce">
                🤵
              </div>

              {/* Header */}
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-1">
                Help is on the way!
              </h2>

              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
                Assigned to Table <span className="font-bold text-indigo-500">#{activeWaiterPopup.tableNumber}</span>
              </p>

              {/* Message Box */}
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40 border border-indigo-200/60 dark:border-indigo-900/50 rounded-2xl p-4 mb-6 text-left">
                <p className="text-sm text-indigo-800 dark:text-indigo-300 font-semibold leading-relaxed">
                  Your waiter <span className="font-extrabold">{activeWaiterPopup.waiterName || ''}</span> has been assigned to your table and will be with you shortly.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => setActiveWaiterPopup(null)}
                  className="w-full py-3.5 px-6 rounded-2xl text-white font-bold text-sm bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg hover:opacity-95 transition-all transform active:scale-95"
                >
                  Awesome, Thanks!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
