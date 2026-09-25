import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import client from '../api/client'
import { restaurantInfo as defaultInfo } from '../data/mockData'

// Return storage key namespaced by the current tenant slug so different
// restaurants on the same browser never share a cached restaurant-info store.
function restaurantKey() {
  if (typeof window === 'undefined') return 'restaurant-store-default'
  const pathMatch = window.location.pathname.match(/^\/r\/([^\/]+)/)
  const slug = pathMatch ? pathMatch[1] : (localStorage.getItem('tenant_slug') || 'default')
  return `restaurant-store-${slug}`
}

export const useRestaurantStore = create(
  persist(
    (set, get) => ({
      info: { ...defaultInfo },

      // ── Fetch restaurant info (tenant-aware) ──────────────
      fetchRestaurant: async (slugOrId) => {
        // Resolve slug from param, URL path /r/:tenantSlug, or localStorage
        let slug = slugOrId
        if (!slug && typeof window !== 'undefined') {
          const pathMatch = window.location.pathname.match(/^\/r\/([^\/]+)/)
          slug = pathMatch ? pathMatch[1] : localStorage.getItem('tenant_slug')
        }

        // If at default root / and no slug provided, keep original ABC restaurant info
        if (!slug || slug === 'abc-restaurant') {
          // If accessing root or default restaurant, fetch public abc-restaurant or use defaultInfo
          try {
            const res = await client.get('/tenants/public/abc-restaurant')
            if (res.data?.name) {
              const data = res.data
              set(s => ({
                info: {
                  ...s.info,
                  id:               data.id            ?? s.info.id,
                  name:             data.name          || defaultInfo.name,
                  nameAm:           data.name_am       || defaultInfo.nameAm,
                  tagline:          data.tagline       || defaultInfo.tagline,
                  description:      data.description   || defaultInfo.description,
                  address:          data.address       || defaultInfo.address,
                  phone:            data.phone         || defaultInfo.phone,
                  wifi:             data.wifi_password || defaultInfo.wifi,
                  hours:            data.working_hours || defaultInfo.hours,
                  vatRate:          data.vat_rate          ?? defaultInfo.vatRate,
                  serviceChargeRate: data.service_charge_rate ?? defaultInfo.serviceChargeRate,
                  currency:         data.currency      || defaultInfo.currency,
                  coverImage:       data.cover_url     || defaultInfo.coverImage,
                  logo:             data.logo_url      || defaultInfo.logo,
                }
              }))
              return
            }
          } catch (_) {}
          return
        }

        // Fetch registered restaurant branding by slug
        try {
          const res = await client.get(`/tenants/public/${slug}`)
          const data = res.data
          if (data && data.name) {
            set(s => ({
              info: {
                ...s.info,
                id:               data.id            ?? s.info.id,
                name:             data.name,
                nameAm:           data.name_am       || '',
                tagline:          data.tagline       || 'Fresh Flavors & Exceptional Dining',
                description:      data.description   || '',
                address:          data.address       || '',
                phone:            data.phone         || '',
                wifi:             data.wifi_password || '',
                hours:            data.working_hours || 'Mon–Sun: 8:00 AM – 10:00 PM',
                vatRate:          data.vat_rate          ?? 0.15,
                serviceChargeRate: data.service_charge_rate ?? 0.10,
                currency:         data.currency      || 'ETB',
                coverImage:       data.cover_url     || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80',
                logo:             data.logo_url      || null,
              }
            }))
          }
        } catch (err) {
          console.warn('fetchRestaurant failed for slug:', slug, err.message)
        }
      },

      // ── Save (called from admin Settings) ───────────────
      saveRestaurant: async (formData, token) => {
        const vatDecimal  = parseFloat(formData.vatRate) / 100
        const svcDecimal  = parseFloat(formData.serviceCharge) / 100

        // Update store immediately so UI reflects everywhere at once
        set(s => ({
          info: {
            ...s.info,
            name:             formData.name,
            nameAm:           formData.nameAm,
            tagline:          formData.tagline,
            address:          formData.address,
            phone:            formData.phone,
            wifi:             formData.wifi,
            hours:            formData.hours,
            vatRate:          vatDecimal,
            serviceChargeRate: svcDecimal,
            currency:         formData.currency,
          }
        }))

        // Persist to API
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
          })
          return res.status === 200
        } catch (_) {
          return false
        }
      },
    }),
    {
      name: restaurantKey(),
      version: 4,
      partialize: s => ({ info: s.info }),
    }
  )
)
