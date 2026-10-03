import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import client from '../api/client'
import { restaurantInfo as defaultInfo } from '../data/mockData'

// Return storage key namespaced by the current tenant slug.
// For admin routes we use the stored tenant_slug so both admin and customer
// sides share the SAME cache key — changes in admin immediately reflect in menu.
function restaurantKey() {
  if (typeof window === 'undefined') return 'restaurant-store-default'
  // Customer route: /r/:tenantSlug/...
  const pathMatch = window.location.pathname.match(/^\/r\/([^/]+)/)
  if (pathMatch) return `restaurant-store-${pathMatch[1]}`
  // Admin / other routes: use the stored tenant slug from login
  const slug = localStorage.getItem('tenant_slug') || 'default'
  return `restaurant-store-${slug}`
}

// Normalise a tenant API response into the store info shape
function normaliseTenant(data, fallback = {}) {
  return {
    id:               data.id                ?? fallback.id,
    name:             data.name              || fallback.name             || '',
    nameAm:           data.name_am           || fallback.nameAm           || '',
    tagline:          data.tagline           || fallback.tagline          || '',
    description:      data.description       || fallback.description      || '',
    address:          data.address           || fallback.address          || '',
    phone:            data.phone             || fallback.phone            || '',
    wifi:             data.wifi_password     || fallback.wifi             || '',
    hours:            data.working_hours     || fallback.hours            || '',
    vatRate:          data.vat_rate          ?? fallback.vatRate          ?? 0.15,
    serviceChargeRate: data.service_charge_rate ?? fallback.serviceChargeRate ?? 0.10,
    currency:         data.currency          || fallback.currency         || 'ETB',
    // logo_url / cover_url: use DB value if present (even empty string means "removed")
    // Only fall back to default when the field is literally null/undefined from DB
    logo:       data.logo_url  !== undefined ? (data.logo_url  || null)  : (fallback.logo  ?? null),
    coverImage: data.cover_url !== undefined
      ? (data.cover_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80')
      : (fallback.coverImage ?? 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80'),
  }
}

export const useRestaurantStore = create(
  persist(
    (set, get) => ({
      info: { ...defaultInfo },

      // ── Fetch restaurant info (tenant-aware) ──────────────────────────────
      fetchRestaurant: async (slugOrId) => {
        let slug = slugOrId
        if (!slug && typeof window !== 'undefined') {
          const pathMatch = window.location.pathname.match(/^\/r\/([^/]+)/)
          slug = pathMatch ? pathMatch[1] : localStorage.getItem('tenant_slug')
        }
        if (!slug) slug = 'abc-restaurant'

        try {
          const res = await client.get(`/tenants/public/${slug}`)
          const data = res.data
          if (data && data.name) {
            set(s => ({ info: normaliseTenant(data, s.info) }))
          }
        } catch (err) {
          console.warn('fetchRestaurant failed for slug:', slug, err.message)
        }
      },

      // ── Save from admin Settings ──────────────────────────────────────────
      saveRestaurant: async (formData, token) => {
        const vatDecimal = parseFloat(formData.vatRate) / 100
        const svcDecimal = parseFloat(formData.serviceCharge) / 100

        const newInfo = {
          ...get().info,
          name:              formData.name,
          nameAm:            formData.nameAm,
          tagline:           formData.tagline,
          address:           formData.address,
          phone:             formData.phone,
          wifi:              formData.wifi,
          hours:             formData.hours,
          vatRate:           vatDecimal,
          serviceChargeRate: svcDecimal,
          currency:          formData.currency,
          logo:              formData.logoUrl  !== undefined ? (formData.logoUrl  || null) : get().info.logo,
          coverImage:        formData.coverUrl !== undefined ? (formData.coverUrl || get().info.coverImage) : get().info.coverImage,
        }

        // 1. Update in-memory store immediately
        set({ info: newInfo })

        // 2. Also write directly to EVERY relevant localStorage key so the
        //    customer-side cache (restaurant-store-<slug>) is updated too
        const slug = localStorage.getItem('tenant_slug') || 'default'
        const customerKey = `restaurant-store-${slug}`
        try {
          const existing = JSON.parse(localStorage.getItem(customerKey) || '{}')
          existing.state = { ...(existing.state || {}), info: newInfo }
          localStorage.setItem(customerKey, JSON.stringify(existing))
        } catch (_) {}

        // 3. Persist to API
        try {
          const res = await client.put('/restaurant', {
            name:                formData.name,
            name_am:             formData.nameAm,
            tagline:             formData.tagline,
            address:             formData.address,
            phone:               formData.phone,
            wifi_password:       formData.wifi,
            working_hours:       formData.hours,
            vat_rate:            vatDecimal,
            service_charge_rate: svcDecimal,
            currency:            formData.currency,
            logo_url:            formData.logoUrl  ?? null,
            cover_url:           formData.coverUrl ?? null,
          })
          return res.status === 200
        } catch (_) {
          return false
        }
      },
    }),
    {
      name: 'restaurant-store',
      version: 6,
      storage: {
        getItem: (_name) => {
          const key = restaurantKey()
          const val = localStorage.getItem(key)
          return val ? JSON.parse(val) : null
        },
        setItem: (_name, value) => {
          const key = restaurantKey()
          localStorage.setItem(key, JSON.stringify(value))
        },
        removeItem: (_name) => {
          const key = restaurantKey()
          localStorage.removeItem(key)
        },
      },
      partialize: s => ({ info: s.info }),
    }
  )
)
