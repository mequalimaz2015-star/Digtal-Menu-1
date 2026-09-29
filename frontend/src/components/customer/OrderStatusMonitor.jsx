import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { motion, AnimatePresence } from 'framer-motion'
import { useOrderStore } from '../../store/useOrderStore'
import { useRestaurantStore } from '../../store/useRestaurantStore'
import toast from 'react-hot-toast'
import { FiVolume2, FiX } from 'react-icons/fi'

// ─── Status display config ────────────────────────────────────────────────────
const statusConfig = {
  new:       { label: 'Order Placed',  icon: '📋', color: 'from-blue-500 to-indigo-600',    sound: 'new' },
  preparing: { label: 'Preparing',     icon: '👨‍🍳', color: 'from-amber-500 to-orange-600',   sound: 'preparing' },
  ready:     { label: 'Ready!',        icon: '✅',  color: 'from-emerald-500 to-teal-600',   sound: 'ready' },
  served:    { label: 'Served',        icon: '🍽️',  color: 'from-purple-500 to-pink-600',    sound: 'served' },
  cancelled: { label: 'Cancelled',     icon: '❌',  color: 'from-red-500 to-rose-600',       sound: 'cancelled' },
}

// ─── Stable per-tab session ID (survives re-renders, not page reloads) ────────
function getCustomerSessionId() {
  let sid = sessionStorage.getItem('customer_session_id')
  if (!sid) {
    sid = `cs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    sessionStorage.setItem('customer_session_id', sid)
  }
  return sid
}

// ─── Audio helper ─────────────────────────────────────────────────────────────
function playStatusSound(soundType = 'ready') {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const tone = (freq, dur, delay = 0, type = 'sine', vol = 0.5) => {
      setTimeout(() => {
        try {
          const osc = ctx.createOscillator()
          const g = ctx.createGain()
          osc.type = type
          osc.frequency.setValueAtTime(freq, ctx.currentTime)
          g.gain.setValueAtTime(vol, ctx.currentTime)
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur)
          osc.connect(g); g.connect(ctx.destination)
          osc.start(); osc.stop(ctx.currentTime + dur)
        } catch (_) {}
      }, delay)
    }
    if (soundType === 'ready') {
      tone(523.25, 0.25, 0,   'triangle', 0.6)
      tone(659.25, 0.25, 150, 'triangle', 0.6)
      tone(783.99, 0.25, 300, 'triangle', 0.7)
      tone(1046.5, 0.6,  450, 'sine',     0.8)
    } else if (soundType === 'served') {
      tone(783.99, 0.3, 0,   'sine', 0.5)
      tone(659.25, 0.4, 200, 'sine', 0.6)
    } else if (soundType === 'preparing') {
      tone(659.25, 0.2, 0,   'sine', 0.4)
      tone(783.99, 0.3, 150, 'sine', 0.5)
    }
  } catch (_) {}
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(soundType === 'ready' ? [300, 100, 300, 100, 500] : [200, 100, 200])
    } catch (_) {}
  }
}

// ─── OS push notification helper ─────────────────────────────────────────────
function sendSystemNotification(title, body) {
  if (!('Notification' in window)) return
  const fire = () => {
    try {
      new Notification(title, {
        body,
        icon: '/mega-logo.png',
        badge: '/favicon.ico',
        tag: 'order-status',
        renotify: true,
        requireInteraction: true,
      })
    } catch (_) {}
  }
  if (Notification.permission === 'granted') fire()
  else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => { if (p === 'granted') fire() })
  }
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function OrderStatusMonitor() {
  const { orders } = useOrderStore()
  const restaurantInfo = useRestaurantStore(s => s.info)

  const [activePopup,       setActivePopup]       = useState(null)
  const [activeWaiterPopup, setActiveWaiterPopup] = useState(null)

  // Prevents the same (orderId, status) pair from firing twice
  const notifiedRef = useRef({})

  // ─── Core handler: show popup + sound + OS notif + toast ──────────────────
  const handleStatusChange = (orderRef, newStatus, orderData = {}) => {
    const key = `${orderRef}-${newStatus}`
    if (notifiedRef.current[key]) return
    notifiedRef.current[key] = true

    const cfg = statusConfig[newStatus] || statusConfig.new
    const tbl = orderData.table_number || orderData.tableNumber || ''

    playStatusSound(cfg.sound)

    const title = `${cfg.icon} Order ${cfg.label}! (${orderRef})`
    const body  = tbl
      ? `Table #${tbl}: Your order status changed to ${cfg.label}.`
      : `Your order status changed to ${cfg.label}.`

    sendSystemNotification(title, body)

    setActivePopup({ orderRef, status: newStatus, tableNumber: tbl, cfg, label: cfg.label })

    toast.custom((t) => (
      <div className={`flex items-center gap-3 bg-gray-900 text-white px-5 py-4 rounded-2xl shadow-2xl border border-gray-800 ${t.visible ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
        <span className="text-3xl">{cfg.icon}</span>
        <div>
          <p className="font-extrabold text-sm">{title}</p>
          <p className="text-xs text-gray-300">{body}</p>
        </div>
      </div>
    ), { duration: 8000 })
  }

  // ─── Socket.io: join scoped rooms, listen only for MY events ──────────────
  useEffect(() => {
    const sessionId = getCustomerSessionId()
    const tenantId  = restaurantInfo?.id   // numeric ID from restaurantStore

    // Build list of order refs this tab has placed (sessionStorage-scoped)
    const getMyRefs = () => {
      try {
        return JSON.parse(sessionStorage.getItem('customer_order_refs') || '[]')
      } catch (_) { return [] }
    }

    const socket = io('/', { transports: ['websocket', 'polling'] })

    socket.on('connect', () => {
      // 1. Join personal customer room: customer-{tenantId}-{sessionId}
      //    Backend will emit order_status_updated ONLY to this room
      if (tenantId && sessionId) {
        socket.emit('join_customer', { tenantId, sessionId })
      }
      // Request browser notification permission early
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
      }
    })

    // 2. Room-scoped: only arrives if backend emitted to our customer room
    socket.on('order_status_updated', (updatedOrder) => {
      if (!updatedOrder) return
      const ref = updatedOrder.order_ref || String(updatedOrder.id)
      handleStatusChange(ref, updatedOrder.status, updatedOrder)
    })

    // 3. Per-order fallback channel (backward compat): `order-{ref}`
    //    Subscribe to one channel per order ref placed this session
    const subscribeToRefs = () => {
      getMyRefs().forEach(ref => {
        socket.on(`order-${ref}`, (updatedOrder) => {
          if (!updatedOrder) return
          handleStatusChange(ref, updatedOrder.status, updatedOrder)
        })
      })
    }
    subscribeToRefs()

    // 4. Waiter-call assignment
    socket.on('waiter_call_assigned', (call) => {
      // Only show if matches one of this customer's order refs or their table
      const myRefs = getMyRefs()
      const myOrders = orders?.filter(o => myRefs.includes(o.id)) || []
      const myTables = [...new Set(myOrders.map(o => String(o.tableNumber || o.table_number)).filter(Boolean))]
      if (!myTables.includes(String(call.tableNumber))) return

      playStatusSound('ready')
      sendSystemNotification(
        '🤵 Waiter Assigned!',
        `${call.waiterName || 'A waiter'} is on their way to Table #${call.tableNumber}.`
      )
      setActiveWaiterPopup(call)
    })

    // Re-subscribe when new orders are placed (refs list may have grown)
    const refPollInterval = setInterval(subscribeToRefs, 5000)

    return () => {
      socket.disconnect()
      clearInterval(refPollInterval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantInfo?.id])

  return (
    <>
      {/* ── Order status popup ── */}
      <AnimatePresence>
        {activePopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{   scale: 0.8, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-gray-800 text-center overflow-hidden"
            >
              <div className={`absolute -top-20 -left-20 w-40 h-40 rounded-full bg-gradient-to-br ${activePopup.cfg.color} opacity-20 blur-3xl`} />
              <div className={`absolute -bottom-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br ${activePopup.cfg.color} opacity-20 blur-3xl`} />

              <button
                onClick={() => setActivePopup(null)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <FiX size={20} />
              </button>

              <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-tr from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center text-4xl shadow-inner mb-4 animate-bounce">
                {activePopup.cfg.icon}
              </div>

              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-1">
                {activePopup.label}!
              </h2>

              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
                Order <span className="font-bold text-orange-500">{activePopup.orderRef}</span>
                {activePopup.tableNumber ? ` · Table ${activePopup.tableNumber}` : ''}
              </p>

              <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 border border-orange-200/60 dark:border-orange-900/50 rounded-2xl p-4 mb-6 text-left">
                <p className="text-xs text-orange-800 dark:text-orange-300 font-semibold leading-relaxed">
                  {activePopup.status === 'ready'     && '🎉 Your food is hot, freshly prepared and ready!'}
                  {activePopup.status === 'served'    && '🍽️ Your order has been served to your table. Bon Appétit!'}
                  {activePopup.status === 'preparing' && '👨‍🍳 The kitchen team has started cooking your meal!'}
                  {activePopup.status === 'cancelled' && '❌ Your order was cancelled. Please speak to staff.'}
                  {activePopup.status === 'new'       && '📋 Your order has been received!'}
                </p>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => playStatusSound(activePopup.cfg.sound)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <FiVolume2 size={16} /> Replay Alert Sound
                </button>
                <button
                  onClick={() => setActivePopup(null)}
                  className={`w-full py-3.5 px-6 rounded-2xl text-white font-bold text-sm bg-gradient-to-r ${activePopup.cfg.color} shadow-lg hover:opacity-95 transition-all active:scale-95`}
                >
                  Awesome, Got It!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Waiter assigned popup ── */}
      <AnimatePresence>
        {activeWaiterPopup && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{   scale: 0.8, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-2xl border border-indigo-100 dark:border-indigo-900 text-center overflow-hidden"
            >
              <div className="absolute -top-20 -left-20 w-40 h-40 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 opacity-20 blur-3xl" />
              <div className="absolute -bottom-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 opacity-20 blur-3xl" />

              <button
                onClick={() => setActiveWaiterPopup(null)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <FiX size={20} />
              </button>

              <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-50 to-blue-100 dark:from-indigo-900/40 dark:to-blue-900/40 flex items-center justify-center text-4xl shadow-inner mb-4 animate-bounce">
                🤵
              </div>

              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-1">Help is on the way!</h2>

              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
                Assigned to Table <span className="font-bold text-indigo-500">#{activeWaiterPopup.tableNumber}</span>
              </p>

              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40 border border-indigo-200/60 dark:border-indigo-900/50 rounded-2xl p-4 mb-6 text-left">
                <p className="text-sm text-indigo-800 dark:text-indigo-300 font-semibold leading-relaxed">
                  Your waiter <span className="font-extrabold">{activeWaiterPopup.waiterName || ''}</span> has been assigned and will be with you shortly.
                </p>
              </div>

              <button
                onClick={() => setActiveWaiterPopup(null)}
                className="w-full py-3.5 px-6 rounded-2xl text-white font-bold text-sm bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg hover:opacity-95 transition-all active:scale-95"
              >
                Awesome, Thanks!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
