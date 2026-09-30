import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTenantNav } from '../../hooks/useTenantNav'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { FiPrinter } from 'react-icons/fi'
import { io } from 'socket.io-client'
import PickupTicket from '../../components/customer/PickupTicket'
import client from '../../api/client'
import toast from 'react-hot-toast'

export default function OrderConfirmation() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { tNavigate } = useTenantNav()
  const { t } = useTranslation()
  const [orderData, setOrderData] = useState(null)
  const [prevStatus, setPrevStatus] = useState(null)
  const [showTicket, setShowTicket] = useState(false)

  const fetchOrderStatus = async () => {
    try {
      const res = await client.get(`/orders/${orderId}`)
      if (res.data) {
        setOrderData(prev => {
          // Detect status change for sound/notification
          if (prev && prev.status !== res.data.status) {
            setPrevStatus(prev.status)
          }
          return res.data
        })
      }
    } catch (_) {}
  }

  useEffect(() => {
    fetchOrderStatus()
    const interval = setInterval(fetchOrderStatus, 4000)

    // Socket.io: get instant update when admin changes status
    const socket = io('/', { transports: ['websocket', 'polling'] })
    socket.on('order_status_updated', (updated) => {
      if (!updated) return
      const ref = updated.order_ref || String(updated.id)
      // Match by order_ref or numeric id
      if (ref === orderId || String(updated.id) === orderId || updated.order_ref === orderId) {
        fetchOrderStatus()
      }
    })

    return () => {
      clearInterval(interval)
      socket.disconnect()
    }
  }, [orderId])

  const status        = orderData?.status || 'new'
  const estimatedTime = orderData?.estimated_time || orderData?.estimatedTime || 20
  const isTakeaway    = orderData?.order_type === 'takeaway'
  const pickupNumber  = orderData?.pickup_number || ''
  const pickupTime    = orderData?.pickup_time   || ''
  const deliveryAddr  = orderData?.delivery_address || ''
  const deliveryLat   = orderData?.delivery_lat
  const deliveryLng   = orderData?.delivery_lng

  // Progress steps differ by order type
  const dineInSteps = [
    { icon: '📋', label: 'Received',  statuses: ['new', 'preparing', 'ready', 'served'] },
    { icon: '👨‍🍳', label: 'Preparing', statuses: ['preparing', 'ready', 'served'] },
    { icon: '✅', label: 'Ready',     statuses: ['ready', 'served'] },
    { icon: '🍽️', label: 'Served',    statuses: ['served'] },
  ]
  const takeawaySteps = [
    { icon: '📋', label: 'Received',   statuses: ['new', 'preparing', 'ready', 'served'] },
    { icon: '👨‍🍳', label: 'Preparing',  statuses: ['preparing', 'ready', 'served'] },
    { icon: '🛍️', label: 'Ready',      statuses: ['ready', 'served'] },
    { icon: '✅', label: 'Picked Up',  statuses: ['served'] },
  ]
  const steps = isTakeaway ? takeawaySteps : dineInSteps

  const getTitle = () => {
    if (isTakeaway) {
      if (status === 'ready')     return '🛍️ Order Ready for Pickup!'
      if (status === 'served')    return '✅ Picked Up! Enjoy!'
      if (status === 'preparing') return '👨‍🍳 Preparing your order...'
      return '📋 Takeaway Order Received!'
    }
    if (status === 'ready')     return '🎉 Food is Ready!'
    if (status === 'served')    return '✅ Enjoy your meal!'
    if (status === 'preparing') return "👨‍🍳 We're cooking it!"
    return t('orderPlaced') || '📋 Order Received!'
  }

  const getSubtitle = () => {
    if (isTakeaway) {
      if (status === 'ready')  return `Come to the counter with pickup number ${pickupNumber}`
      if (status === 'served') return 'Thank you for your order!'
      return pickupTime ? `Estimated pickup: ${pickupTime}` : `Estimated ready in ~${estimatedTime} min`
    }
    if (status === 'ready') return 'Your waiter is on the way 🚀'
    return t('thankYou')
  }

  const mainEmoji = () => {
    if (status === 'ready') return isTakeaway ? '🛍️' : '✅'
    if (status === 'served') return '✅'
    return isTakeaway ? '🛍️' : '🎉'
  }

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${
      isTakeaway
        ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-950 dark:to-gray-900'
        : 'bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-950 dark:to-gray-900'
    }`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center"
      >
        {/* Order type badge */}
        <div className="flex justify-center mb-4">
          <span className={`text-xs font-bold px-4 py-1.5 rounded-full ${
            isTakeaway
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
          }`}>
            {isTakeaway ? '🛍️ Takeaway Order' : '🪑 Dine-In Order'}
          </span>
        </div>

        {/* Success icon */}
        <motion.div
          key={status}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', damping: 15 }}
          className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${
            status === 'ready'
              ? isTakeaway ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-green-100 dark:bg-green-900/30'
              : isTakeaway ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-orange-100 dark:bg-orange-900/30'
          }`}
        >
          <span className="text-5xl">{mainEmoji()}</span>
        </motion.div>

        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{getTitle()}</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-1 text-sm">{getSubtitle()}</p>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-2 inline-block my-3">
            <span className={`font-bold ${isTakeaway ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
              {t('orderNumber')} #{orderData?.id?.toString().slice(-6) || orderId?.slice(-6) || orderId}
            </span>
          </div>
        </motion.div>

        {/* ── TAKEAWAY: Prominent pickup number card ── */}
        <AnimatePresence>
          {isTakeaway && pickupNumber && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 my-4 text-white shadow-lg shadow-blue-200 dark:shadow-none"
            >
              <p className="text-xs font-semibold text-blue-100 uppercase tracking-widest mb-1">Your Pickup Number</p>
              <p className="text-5xl font-black tracking-wider mb-1">{pickupNumber}</p>
              {pickupTime && (
                <p className="text-sm text-blue-100">⏰ Ready by {pickupTime}</p>
              )}
              <p className="text-xs text-blue-200 mt-2">Show this number at the counter</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── TAKEAWAY: Pickup ticket button ── */}
        {isTakeaway && pickupNumber && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowTicket(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-blue-400 dark:border-blue-600 text-blue-600 dark:text-blue-400 font-bold text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors mb-1"
          >
            <FiPrinter size={16} />
            View &amp; Print Pickup Ticket
          </motion.button>
        )}

        {/* ── TAKEAWAY: Delivery / Destination Location ── */}
        <AnimatePresence>
          {isTakeaway && deliveryAddr && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32 }}
              className="my-4 text-left"
            >
              {/* Map preview */}
              {deliveryLat && deliveryLng && (
                <div className="rounded-2xl overflow-hidden mb-3 border border-blue-100 dark:border-blue-900 shadow-sm">
                  <img
                    src={`https://staticmap.openstreetmap.de/staticmap.php?center=${deliveryLat},${deliveryLng}&zoom=15&size=600x180&markers=${deliveryLat},${deliveryLng},red`}
                    alt="Delivery location"
                    className="w-full h-32 object-cover"
                    onError={e => { e.target.style.display = 'none' }}
                  />
                </div>
              )}
              <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-800">
                <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                  <span className="text-white text-base">📍</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest mb-1">
                    Destination
                  </p>
                  <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">
                    {deliveryAddr}
                  </p>
                  {deliveryLat && deliveryLng && (
                    <a
                      href={`https://www.google.com/maps?q=${deliveryLat},${deliveryLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 font-semibold mt-2"
                    >
                      🗺️ Open in Google Maps →
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preparation timer (not shown when ready/served) */}
        {status !== 'ready' && status !== 'served' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-50 dark:bg-gray-700 rounded-2xl p-5 my-4"
          >
            <div className="flex justify-center gap-3 mb-3">
              {['🍳', '👨‍🍳', isTakeaway ? '🛍️' : '🍽️'].map((emoji, i) => (
                <motion.span
                  key={i}
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                  className="text-2xl"
                >
                  {emoji}
                </motion.span>
              ))}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t('estimatedTime')}</p>
            <p className="text-3xl font-bold text-orange-500">
              ~{estimatedTime} <span className="text-lg">{t('minutes')}</span>
            </p>
          </motion.div>
        )}

        {/* Progress steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-5 px-1">
            {steps.map((step, i) => {
              const isDone = step.statuses.includes(status)
              return (
                <div key={i} className="flex flex-col items-center gap-1 flex-1">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl transition-all duration-500 ${
                    isDone
                      ? isTakeaway
                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                        : 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                      : 'bg-gray-100 dark:bg-gray-600 opacity-40'
                  }`}>
                    {step.icon}
                  </div>
                  <span className={`font-semibold mt-1 transition-colors text-center leading-tight ${
                    isDone ? isTakeaway ? 'text-blue-500' : 'text-orange-500' : ''
                  }`}>
                    {step.label}
                  </span>
                  {/* Connector line */}
                  {i < steps.length - 1 && (
                    <div className="absolute" style={{ display: 'none' }} />
                  )}
                </div>
              )
            })}
          </div>

          <button
            onClick={() => tNavigate('/menu')}
            className={`w-full font-bold py-4 rounded-2xl transition-colors shadow-lg mt-2 text-white ${
              isTakeaway
                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-blue-200 dark:shadow-none'
                : 'bg-orange-500 hover:bg-orange-600 shadow-orange-200 dark:shadow-none'
            }`}
          >
            {t('backToMenu')}
          </button>
        </motion.div>
      </motion.div>

      {/* ── Pickup Ticket Modal ── */}
      <PickupTicket
        open={showTicket}
        onClose={() => setShowTicket(false)}
        pickupNumber={pickupNumber}
        pickupTime={pickupTime}
        orderId={orderData?.order_ref || orderData?.id?.toString() || orderId}
        customerName={orderData?.customer_name || ''}
        items={(orderData?.items || []).map(i => ({
          name: i.menu_item_name || i.name,
          qty:  i.quantity       || i.qty,
          price: i.price,
        }))}
        grandTotal={orderData?.grand_total || orderData?.grandTotal || 0}
        deliveryAddress={deliveryAddr}
      />
    </div>
  )
}
