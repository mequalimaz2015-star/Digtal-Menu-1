import { useState, useEffect } from 'react'
import client from '../../api/client'
import { Bike, Package, MapPin, Phone, CheckCircle, Navigation, Clock, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

export default function RiderDashboard() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRiderOrders()
  }, [])

  const fetchRiderOrders = async () => {
    setLoading(true)
    try {
      const res = await client.get('/delivery/rider/orders')
      setOrders(res.data)
    } catch (err) {
      toast.error('Failed to fetch delivery orders')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (orderId, newDeliveryStatus, newOrderStatus) => {
    try {
      await client.put(`/delivery/rider/orders/${orderId}/status`, {
        delivery_status: newDeliveryStatus,
        status: newOrderStatus
      })
      toast.success(`Order status updated to: ${newDeliveryStatus}`)
      fetchRiderOrders()
    } catch (err) {
      toast.error('Failed to update status')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Bike className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Rider Delivery Portal</h1>
              <p className="text-xs text-slate-400">Live Delivery Order Management</p>
            </div>
          </div>

          <button
            onClick={fetchRiderOrders}
            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <Package className="w-12 h-12 mx-auto text-slate-600 mb-3" />
            <p className="font-semibold text-base">No pending delivery orders</p>
            <p className="text-xs text-slate-500 mt-1">New delivery orders will appear here automatically.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-mono px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md font-bold">
                      {order.order_ref}
                    </span>
                    <h3 className="text-lg font-bold text-white mt-2">{order.customer_name || 'Customer'}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                      <Phone className="w-3.5 h-3.5 text-amber-400" /> {order.phone || 'No phone'}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-extrabold text-emerald-400">
                      {order.grand_total} ETB
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Payment: {order.payment_method} ({order.payment_status})
                    </span>
                  </div>
                </div>

                {/* Delivery Address */}
                <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 flex items-start gap-3 text-sm">
                  <MapPin className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-white">Delivery Destination</div>
                    <div className="text-xs text-slate-300 mt-0.5">{order.delivery_address || 'No detailed address specified'}</div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex flex-wrap gap-3">
                  {order.delivery_status === 'pending' && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'picked_up', 'preparing')}
                      className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20"
                    >
                      Mark Picked Up from Kitchen
                    </button>
                  )}

                  {order.delivery_status === 'picked_up' && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'out_for_delivery', 'preparing')}
                      className="flex-1 py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-blue-500/20"
                    >
                      On The Way to Customer
                    </button>
                  )}

                  {order.delivery_status === 'out_for_delivery' && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'delivered', 'served')}
                      className="flex-1 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" /> Confirm Delivered & Complete
                    </button>
                  )}

                  {order.delivery_status === 'delivered' && (
                    <span className="px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" /> Order Successfully Delivered
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
