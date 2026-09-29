import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import client from '../api/client'

// Use the axios client so X-Tenant-Slug and Authorization headers
// are automatically attached via the request interceptor
const API_URL = '/api'

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = 880; osc.type = 'sine'
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.start(); osc.stop(ctx.currentTime + 0.6)
  } catch (_) {}
}

export const useOrderStore = create(
  persist(
    (set, get) => ({
      orders: [],
      unreadCount: 0,
      notifications: [],
      lastFetchedAt: null,

      // ── Customer places order → saved to SQL Server via API ──
      placeOrder: async (orderData) => {
        try {
          // Attach per-tab session ID so the backend can route real-time
          // order_status_updated events only to this customer's socket room
          const sessionId = (() => {
            let sid = sessionStorage.getItem('customer_session_id')
            if (!sid) {
              sid = `cs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
              sessionStorage.setItem('customer_session_id', sid)
            }
            return sid
          })()

          const res = await client.post('/orders', { ...orderData, sessionId })
          const savedOrder = res.data

          const localOrder = {
            ...orderData,
            id:               savedOrder.order_ref || savedOrder.id?.toString() || `ORD-${Date.now()}`,
            dbId:             savedOrder.id,
            pickup_number:    savedOrder.pickup_number    || '',
            pickup_time:      savedOrder.pickup_time      || orderData.pickupTime || '',
            order_type:       savedOrder.order_type       || orderData.orderType  || 'dine_in',
            delivery_address: savedOrder.delivery_address || orderData.deliveryAddress || '',
            delivery_lat:     savedOrder.delivery_lat     || orderData.deliveryLat || null,
            delivery_lng:     savedOrder.delivery_lng     || orderData.deliveryLng || null,
            status:           'new',
            createdAt:        savedOrder.created_at || new Date().toISOString(),
            readByAdmin:      false,
          }

          set(s => ({ orders: [localOrder, ...s.orders].slice(0, 100) }))

          // Store order ref in sessionStorage so OrderStatusMonitor can track it
          // even when the customer has no auth token (cross-device polling)
          try {
            const existing = JSON.parse(sessionStorage.getItem('customer_order_refs') || '[]')
            const updated = [localOrder.id, ...existing].slice(0, 20)
            sessionStorage.setItem('customer_order_refs', JSON.stringify(updated))
            // Also seed the status as 'new' for the monitor
            const statuses = JSON.parse(sessionStorage.getItem('customer_order_statuses') || '{}')
            statuses[localOrder.id] = 'new'
            sessionStorage.setItem('customer_order_statuses', JSON.stringify(statuses))
          } catch (_) {}

          localStorage.setItem('new-order-event', JSON.stringify({ order: localOrder, ts: Date.now() }))
          playBeep()
          return localOrder

        } catch (err) {
          console.warn('API unavailable, saving locally:', err.message)
          const localOrder = {
            ...orderData,
            id: `ORD-${Date.now()}`,
            status: 'new',
            createdAt: new Date().toISOString(),
            readByAdmin: false,
            isLocal: true,
          }
          set(s => ({
            orders: [localOrder, ...s.orders].slice(0, 100),
            unreadCount: s.unreadCount + 1,
            notifications: [{
              id: Date.now().toString(),
              type: 'new_order',
              title: '🛎️ New Order!',
              message: `Table ${localOrder.tableNumber} · ${localOrder.grandTotal?.toFixed(0)} ETB`,
              orderId: localOrder.id,
              read: false,
              createdAt: new Date().toISOString(),
            }, ...s.notifications].slice(0, 50),
          }))
          localStorage.setItem('new-order-event', JSON.stringify({ order: localOrder, ts: Date.now() }))
          playBeep()
          return localOrder
        }
      },

      // ── Admin fetches all orders from API ──
      fetchOrders: async (token) => {
        try {
          // Use axios client so X-Tenant-Slug is always attached
          const res = await client.get('/orders')
          const data = res.data

          // Map API orders to frontend format
          const mapped = data.map(o => ({
            id: o.order_ref || o.id?.toString(),
            dbId: o.id,
            tableNumber: o.table_number,
            customerName: o.customer_name,
            phone: o.phone,
            notes: o.notes,
            status: o.status,
            subtotal: o.subtotal,
            vat: o.vat,
            serviceCharge: o.service_charge,
            grandTotal: o.grand_total,
            estimatedTime: o.estimated_time,
            createdAt: o.created_at,
            readByAdmin: true,
            items: (o.items || []).map(i => ({
              name: i.menu_item_name,
              qty: i.quantity,
              price: i.price,
              modifiers: i.modifiers,
              specialInstructions: i.special_instructions,
            })),
          }))

          // Check for new unread orders
          const existing = get().orders
          const newOrders = mapped.filter(o =>
            !existing.find(e => e.id === o.id)
          )

          if (newOrders.length > 0) {
            set(s => ({
              unreadCount: s.unreadCount + newOrders.length,
              notifications: [
                ...newOrders.map(o => ({
                  id: `notif-${o.id}`,
                  type: 'new_order',
                  title: '🛎️ New Order!',
                  message: `Table ${o.tableNumber} · ${o.grandTotal?.toFixed(0)} ETB`,
                  orderId: o.id,
                  read: false,
                  createdAt: o.createdAt,
                })),
                ...s.notifications,
              ].slice(0, 50),
            }))
            playBeep()
          }

          set({ orders: mapped, lastFetchedAt: new Date().toISOString() })
        } catch (err) {
          console.warn('Could not fetch orders from API:', err.message)
        }
      },

      // ── Admin updates order status ──
      updateOrderStatus: async (id, status, token) => {
        // Update locally first (optimistic)
        set(s => ({
          orders: s.orders.map(o => o.id === id ? { ...o, status } : o),
        }))

        // Find DB id
        const order = get().orders.find(o => o.id === id)
        const dbId = order?.dbId

        if (dbId && token) {
          try {
            await client.put(`/orders/${dbId}/status`, { status })
          } catch (err) {
            console.warn('Could not update order status via API:', err.message)
          }
        }

        localStorage.setItem('order-status-event', JSON.stringify({ id, status, ts: Date.now() }))
      },

      deleteOrder: (id) => set(s => ({ orders: s.orders.filter(o => o.id !== id) })),

      markAllRead: () => set(s => ({
        unreadCount: 0,
        notifications: s.notifications.map(n => ({ ...n, read: true })),
        orders: s.orders.map(o => ({ ...o, readByAdmin: true })),
      })),

      markNotificationRead: (id) => set(s => ({
        notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n),
        unreadCount: Math.max(0, s.unreadCount - 1),
      })),

      clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
    }),
    {
      name: 'order-store',
      partialize: (s) => ({
        orders: s.orders,
        notifications: s.notifications,
        unreadCount: s.unreadCount,
      }),
    }
  )
)
