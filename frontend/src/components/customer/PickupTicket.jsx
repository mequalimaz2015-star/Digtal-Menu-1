import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiPrinter, FiDownload, FiShare2 } from 'react-icons/fi'

/**
 * PickupTicket
 * Props:
 *   open          – boolean
 *   onClose       – () => void
 *   pickupNumber  – string  e.g. "T-003"
 *   pickupTime    – string  e.g. "02:45 PM"
 *   orderId       – string
 *   customerName  – string
 *   items         – array { name, qty, price }
 *   grandTotal    – number
 *   restaurantName – string
 *   deliveryAddress – string (optional)
 */
export default function PickupTicket({
  open, onClose,
  pickupNumber, pickupTime, orderId,
  customerName, items = [], grandTotal,
  restaurantName = 'MEGA Digital Menu',
  deliveryAddress,
}) {
  const ticketRef = useRef(null)

  const handlePrint = () => {
    const content = ticketRef.current?.innerHTML
    if (!content) return
    const w = window.open('', '_blank', 'width=420,height=700')
    w.document.write(`
      <html>
      <head>
        <title>Pickup Ticket ${pickupNumber}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Courier New', monospace; background: #fff; color: #111; }
          .ticket { max-width: 360px; margin: 0 auto; padding: 24px 20px; }
          .header { text-align: center; margin-bottom: 16px; }
          .restaurant { font-size: 18px; font-weight: 900; }
          .subtitle { font-size: 11px; color: #666; margin-top: 2px; }
          .divider { border-top: 2px dashed #ccc; margin: 12px 0; }
          .pickup-box { background: #1d4ed8; color: #fff; border-radius: 16px; padding: 20px; text-align: center; margin: 12px 0; }
          .pickup-label { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; opacity: 0.8; }
          .pickup-number { font-size: 56px; font-weight: 900; line-height: 1; letter-spacing: 4px; margin: 8px 0; }
          .pickup-time { font-size: 13px; opacity: 0.85; }
          .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #555; margin-bottom: 6px; }
          .info-row { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
          .items-list { margin-top: 6px; }
          .item-row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; border-bottom: 1px dotted #eee; }
          .total-row { display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; padding-top: 8px; color: #1d4ed8; }
          .footer { text-align: center; font-size: 10px; color: #999; margin-top: 16px; line-height: 1.6; }
          .delivery { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 10px; margin: 8px 0; font-size: 11px; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body onload="window.print(); window.close()">
        <div class="ticket">
          <div class="header">
            <div class="restaurant">🍽️ ${restaurantName}</div>
            <div class="subtitle">Takeaway Pickup Ticket</div>
          </div>
          <div class="divider"></div>
          <div class="pickup-box">
            <div class="pickup-label">Your Pickup Number</div>
            <div class="pickup-number">${pickupNumber}</div>
            ${pickupTime ? `<div class="pickup-time">⏰ Ready by ${pickupTime}</div>` : ''}
            <div style="font-size:11px;opacity:0.7;margin-top:6px">Show this at the counter</div>
          </div>
          <div class="divider"></div>
          <div class="section-title">Order Details</div>
          <div class="info-row"><span>Order Ref</span><span>#${orderId?.slice(-8) || orderId}</span></div>
          ${customerName ? `<div class="info-row"><span>Name</span><span>${customerName}</span></div>` : ''}
          <div class="info-row"><span>Date</span><span>${new Date().toLocaleString()}</span></div>
          ${deliveryAddress ? `
            <div class="divider"></div>
            <div class="delivery">
              <div class="section-title" style="margin-bottom:4px">📍 Destination</div>
              <div style="font-size:11px;line-height:1.4">${deliveryAddress}</div>
            </div>
          ` : ''}
          <div class="divider"></div>
          <div class="section-title">Items</div>
          <div class="items-list">
            ${(items || []).map(i => `
              <div class="item-row">
                <span>${i.qty}× ${i.name}</span>
                <span>${((i.price || 0) * (i.qty || 1)).toFixed(0)} ETB</span>
              </div>
            `).join('')}
          </div>
          <div class="total-row">
            <span>TOTAL</span>
            <span>${(grandTotal || 0).toFixed(0)} ETB</span>
          </div>
          <div class="divider"></div>
          <div class="footer">
            Thank you for your order!<br>
            ${restaurantName} · Digital Menu<br>
            <span style="font-size:9px">Bole Road, Addis Ababa · +251 91 859 2028</span>
          </div>
        </div>
      </body>
      </html>
    `)
    w.document.close()
  }

  const handleShare = async () => {
    const text = `🛍️ Takeaway Pickup Ticket\nRestaurant: ${restaurantName}\nPickup No: ${pickupNumber}${pickupTime ? `\nReady by: ${pickupTime}` : ''}\nOrder: #${orderId?.slice(-8)}\nTotal: ${(grandTotal || 0).toFixed(0)} ETB`
    if (navigator.share) {
      try {
        await navigator.share({ title: `Pickup Ticket ${pickupNumber}`, text })
      } catch (_) {}
    } else {
      await navigator.clipboard.writeText(text)
      // toast handled by parent
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[500] flex items-end sm:items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%', scale: 0.95 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: '100%', scale: 0.95 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Action bar */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-black text-gray-900 dark:text-white text-base">🎫 Pickup Ticket</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <FiPrinter size={13} /> Print
                </button>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                >
                  <FiShare2 size={13} /> Share
                </button>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <FiX size={16} />
                </button>
              </div>
            </div>

            {/* Ticket body */}
            <div ref={ticketRef} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">

              {/* Restaurant header */}
              <div className="text-center">
                <p className="text-lg font-black text-gray-900 dark:text-white">🍽️ {restaurantName}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Takeaway Pickup Ticket</p>
              </div>

              {/* Dashed divider */}
              <div className="border-t-2 border-dashed border-gray-200 dark:border-gray-700" />

              {/* Big pickup number */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', damping: 14 }}
                className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 text-center text-white shadow-lg shadow-blue-200 dark:shadow-none"
              >
                <p className="text-[10px] font-bold tracking-[3px] uppercase text-blue-100 mb-2">
                  YOUR PICKUP NUMBER
                </p>
                <p className="text-[64px] font-black leading-none tracking-widest">
                  {pickupNumber}
                </p>
                {pickupTime && (
                  <p className="text-sm text-blue-100 mt-3 flex items-center justify-center gap-1.5">
                    ⏰ Ready by <span className="font-bold text-white">{pickupTime}</span>
                  </p>
                )}
                <p className="text-[11px] text-blue-200 mt-2">Show this number at the counter</p>
              </motion.div>

              {/* Dashed divider */}
              <div className="border-t-2 border-dashed border-gray-200 dark:border-gray-700" />

              {/* Order details */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Order Info</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Order Ref</span>
                  <span className="font-bold text-gray-900 dark:text-white">#{orderId?.slice(-8) || orderId}</span>
                </div>
                {customerName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Name</span>
                    <span className="font-bold text-gray-900 dark:text-white">{customerName}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Date</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {new Date().toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}
                    {' '}{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Delivery address */}
              {deliveryAddress && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-800">
                  <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">📍 Destination</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{deliveryAddress}</p>
                </div>
              )}

              {/* Dashed divider */}
              <div className="border-t-2 border-dashed border-gray-200 dark:border-gray-700" />

              {/* Items */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Items</p>
                <div className="space-y-1.5">
                  {(items || []).map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">
                        <span className="font-bold text-blue-500">×{item.qty}</span> {item.name}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {((item.price || 0) * (item.qty || 1)).toFixed(0)} ETB
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-black text-base pt-3 mt-2 border-t border-gray-100 dark:border-gray-800 text-blue-600 dark:text-blue-400">
                  <span>TOTAL</span>
                  <span>{(grandTotal || 0).toFixed(0)} ETB</span>
                </div>
              </div>

              {/* Dashed divider */}
              <div className="border-t-2 border-dashed border-gray-200 dark:border-gray-700" />

              {/* Footer */}
              <div className="text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
                  Thank you for your order!<br />
                  {restaurantName} · Digital Menu<br />
                  <span className="text-[11px]">Bole Road, Addis Ababa · +251 91 859 2028</span>
                </p>
              </div>

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
