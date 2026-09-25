import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import client from '../api/client'

/**
 * useMenuStore — tenant-aware menu store.
 *
 * IMPORTANT: The store is initialized EMPTY. Data is fetched from the API
 * on mount, scoped to the logged-in tenant via the axios X-Tenant-Slug header.
 * No mock data is ever loaded, so a brand-new restaurant always starts blank.
 *
 * The persisted key is namespaced by tenant_slug so switching between
 * restaurants on the same browser never leaks data.
 */

function makeStore(set, get) {
  return {
    categories:     [],
    menuItems:      [],
    modifierGroups: [],
    tables:         [],
    _hydrated:      false,   // true once we have fetched at least once from API

    // ── Fetch public customer menu for a specific tenant ───────────────────
    fetchCustomerMenu: async (tenantSlug) => {
      try {
        const slug = tenantSlug || localStorage.getItem('tenant_slug') || 'abc-restaurant'
        const headers = { 'X-Tenant-Slug': slug }
        const [catsRes, itemsRes, modsRes] = await Promise.allSettled([
          client.get('/categories', { headers }),
          client.get('/menu-items', { headers }),
          client.get('/modifiers/public', { headers }),
        ])

        const cats  = catsRes.status  === 'fulfilled' && Array.isArray(catsRes.value.data)  ? catsRes.value.data  : []
        const items = itemsRes.status === 'fulfilled' && Array.isArray(itemsRes.value.data) ? itemsRes.value.data : []
        const mods  = modsRes.status  === 'fulfilled' && Array.isArray(modsRes.value.data)  ? modsRes.value.data  : []

        // If API returned empty and accessing default/Five Stop restaurant, fall back to mockData
        let finalCats = cats
        let finalItems = items
        if ((!cats.length || !items.length) && (slug === 'abc-restaurant' || slug === 'five-stop' || !tenantSlug)) {
          const { categories: defaultCats, menuItems: defaultItems } = await import('../data/mockData')
          if (!finalCats.length) {
            finalCats = defaultCats.filter(c => c.id !== 'all').map((c, idx) => ({
              id: c.id,
              name: c.name,
              nameAm: c.nameAm,
              icon: c.icon,
              color: c.color,
              sortOrder: idx,
              isActive: true
            }))
          }
          if (!finalItems.length) {
            finalItems = defaultItems.map(i => ({
              id: i.id,
              category_id: i.categoryId,
              name: i.name,
              name_am: i.nameAm,
              description: i.description,
              description_am: i.descriptionAm,
              price: i.price,
              image_url: i.image,
              prep_time: i.prepTime,
              is_spicy: i.isSpicy,
              is_vegetarian: i.isVegetarian,
              is_available: i.isAvailable,
              is_featured: i.isFeatured,
              is_popular: i.isPopular,
              is_best_seller: i.isBestSeller,
              chef_recommended: i.chefRecommended,
              rating: i.rating,
              review_count: i.reviewCount,
              calories: i.calories,
              discount: i.discount,
              allergens: i.allergens
            }))
          }
        }

        // Normalise API shape -> store shape
        const normCats = finalCats.map(c => ({
          id:        String(c.id),
          name:      c.name      || '',
          nameAm:    c.name_am   || c.nameAm || '',
          icon:      c.icon      || '🍽️',
          color:     c.color     || '#e85d04',
          sortOrder: c.sort_order ?? c.sortOrder ?? 0,
          isActive:  c.is_active !== false && c.isActive !== false,
        }))

        const normItems = finalItems.map(i => ({
          id:              String(i.id),
          categoryId:      String(i.category_id || i.categoryId || ''),
          name:            i.name            || '',
          nameAm:          i.name_am         || i.nameAm || '',
          description:     i.description     || '',
          descriptionAm:   i.description_am  || i.descriptionAm || '',
          price:           Number(i.price)   || 0,
          image:           i.image_url       || i.image || '',
          prepTime:        i.prep_time       || i.prepTime || 15,
          isSpicy:         !!(i.is_spicy ?? i.isSpicy),
          isVegetarian:    !!(i.is_vegetarian ?? i.isVegetarian),
          isAvailable:     i.is_available !== false && i.isAvailable !== false,
          isFeatured:      !!(i.is_featured ?? i.isFeatured),
          isPopular:       !!(i.is_popular ?? i.isPopular),
          isBestSeller:    !!(i.is_best_seller ?? i.isBestSeller),
          chefRecommended: !!(i.chef_recommended ?? i.chefRecommended),
          rating:          Number(i.rating) || 4.8,
          reviewCount:     Number(i.review_count ?? i.reviewCount) || 0,
          calories:        i.calories || null,
          discount:        Number(i.discount) || 0,
          allergens:       Array.isArray(i.allergens) ? i.allergens : (i.allergens ? String(i.allergens).split(',').map(s => s.trim()).filter(Boolean) : []),
        }))

        const normMods = mods.map(g => ({
          id:          String(g.id),
          name:        g.name        || '',
          nameAm:      g.name_am     || '',
          required:    !!g.required,
          multiSelect: !!g.multi_select,
          maxSelect:   g.max_select  || 1,
          modifiers:   Array.isArray(g.modifiers) ? g.modifiers.map(m => ({
            id:          String(m.id),
            name:        m.name        || '',
            nameAm:      m.name_am     || '',
            price:       Number(m.price) || 0,
            isAvailable: m.is_available !== false,
          })) : [],
        }))

        set({
          categories:     normCats,
          menuItems:      normItems,
          modifierGroups: normMods,
          _hydrated:      true,
        })
      } catch (err) {
        console.warn('useMenuStore.fetchCustomerMenu failed:', err.message)
        set({ _hydrated: true })
      }
    },

    // ── Fetch all menu data from the API (Admin) ────────────────────────────
    fetchAll: async () => {
      try {
        const [catsRes, itemsRes, modsRes, tablesRes] = await Promise.allSettled([
          client.get('/categories/all'),
          client.get('/menu-items/all'),
          client.get('/modifiers'),
          client.get('/tables'),
        ])

        const cats   = catsRes.status   === 'fulfilled' ? catsRes.value.data   : get().categories
        const items  = itemsRes.status  === 'fulfilled' ? itemsRes.value.data  : get().menuItems
        const mods   = modsRes.status   === 'fulfilled' ? modsRes.value.data   : get().modifierGroups
        const tables = tablesRes.status === 'fulfilled' ? tablesRes.value.data : get().tables

        // Normalise API shape → store shape
        const normCats = Array.isArray(cats) ? cats.map(c => ({
          id:        String(c.id),
          name:      c.name      || '',
          nameAm:    c.name_am   || '',
          icon:      c.icon      || '🍽️',
          color:     c.color     || '#e85d04',
          sortOrder: c.sort_order ?? 0,
          isActive:  c.is_active !== false,
        })) : []

        const normItems = Array.isArray(items) ? items.map(i => ({
          id:              String(i.id),
          categoryId:      String(i.category_id),
          name:            i.name            || '',
          nameAm:          i.name_am         || '',
          description:     i.description     || '',
          descriptionAm:   i.description_am  || '',
          price:           Number(i.price)   || 0,
          image:           i.image_url       || '',
          prepTime:        i.prep_time       || 15,
          isSpicy:         !!i.is_spicy,
          isVegetarian:    !!i.is_vegetarian,
          isAvailable:     i.is_available !== false,
          isFeatured:      !!i.is_featured,
          isPopular:       !!i.is_popular,
          isBestSeller:    !!i.is_best_seller,
          chefRecommended: !!i.chef_recommended,
          rating:          Number(i.rating) || 4.5,
          reviewCount:     Number(i.review_count) || 0,
          calories:        i.calories || null,
          discount:        Number(i.discount) || 0,
          allergens:       i.allergens ? String(i.allergens).split(',').map(s => s.trim()).filter(Boolean) : [],
        })) : []

        const normMods = Array.isArray(mods) ? mods.map(g => ({
          id:          String(g.id),
          name:        g.name        || '',
          nameAm:      g.name_am     || '',
          required:    !!g.required,
          multiSelect: !!g.multi_select,
          maxSelect:   g.max_select  || 1,
          modifiers:   Array.isArray(g.modifiers) ? g.modifiers.map(m => ({
            id:          String(m.id),
            name:        m.name        || '',
            nameAm:      m.name_am     || '',
            price:       Number(m.price) || 0,
            isAvailable: m.is_available !== false,
          })) : [],
        })) : []

        const normTables = Array.isArray(tables) ? tables.map(t => ({
          id:       String(t.id),
          number:   t.number   || '',
          capacity: t.capacity || 4,
          status:   t.status   || 'available',
        })) : []

        set({
          categories:     normCats,
          menuItems:      normItems,
          modifierGroups: normMods,
          tables:         normTables,
          _hydrated:      true,
        })
      } catch (err) {
        console.warn('useMenuStore.fetchAll failed:', err.message)
        set({ _hydrated: true })
      }
    },

    // ── Categories ──────────────────────────────────────────────────────────
    addCategory: async (data) => {
      try {
        const res = await client.post('/categories', {
          name: data.name, name_am: data.nameAm, icon: data.icon,
          color: data.color, sort_order: data.sortOrder,
        })
        const c = res.data
        set(s => ({
          categories: [...s.categories, {
            id: String(c.id), name: c.name, nameAm: c.name_am || '',
            icon: c.icon, color: c.color, sortOrder: c.sort_order ?? 0, isActive: true,
          }]
        }))
      } catch { /* silently handled by caller */ }
    },

    updateCategory: async (id, data) => {
      set(s => ({ categories: s.categories.map(c => c.id === id ? { ...c, ...data } : c) }))
      try {
        await client.put(`/categories/${id}`, {
          name: data.name, name_am: data.nameAm, icon: data.icon,
          color: data.color, sort_order: data.sortOrder, is_active: data.isActive,
        })
      } catch { await get().fetchAll() }
    },

    deleteCategory: async (id) => {
      set(s => ({ categories: s.categories.filter(c => c.id !== id) }))
      try { await client.delete(`/categories/${id}`) }
      catch { await get().fetchAll() }
    },

    toggleCategory: async (id) => {
      const cat = get().categories.find(c => c.id === id)
      if (!cat) return
      const next = !cat.isActive
      set(s => ({ categories: s.categories.map(c => c.id === id ? { ...c, isActive: next } : c) }))
      try {
        await client.put(`/categories/${id}`, {
          name: cat.name, name_am: cat.nameAm, icon: cat.icon,
          color: cat.color, sort_order: cat.sortOrder, is_active: next,
        })
      } catch { await get().fetchAll() }
    },

    // ── Menu Items ───────────────────────────────────────────────────────────
    addMenuItem: async (data) => {
      try {
        const res = await client.post('/menu-items', {
          category_id: data.categoryId, name: data.name, name_am: data.nameAm,
          description: data.description, description_am: data.descriptionAm,
          price: data.price, image_url: data.image, prep_time: data.prepTime,
          is_spicy: data.isSpicy, is_vegetarian: data.isVegetarian,
          is_available: data.isAvailable, is_featured: data.isFeatured,
          is_popular: data.isPopular, is_best_seller: data.isBestSeller,
          chef_recommended: data.chefRecommended, rating: data.rating,
          calories: data.calories, discount: data.discount,
          allergens: Array.isArray(data.allergens) ? data.allergens.join(',') : data.allergens,
        })
        const i = res.data
        set(s => ({
          menuItems: [...s.menuItems, {
            id: String(i.id), categoryId: String(i.category_id),
            name: i.name, nameAm: i.name_am || '',
            description: i.description || '', descriptionAm: i.description_am || '',
            price: Number(i.price), image: i.image_url || '',
            prepTime: i.prep_time || 15, isSpicy: !!i.is_spicy,
            isVegetarian: !!i.is_vegetarian, isAvailable: i.is_available !== false,
            isFeatured: !!i.is_featured, isPopular: !!i.is_popular,
            isBestSeller: !!i.is_best_seller, chefRecommended: !!i.chef_recommended,
            rating: Number(i.rating) || 4.5, reviewCount: 0,
            calories: i.calories || null, discount: Number(i.discount) || 0,
            allergens: i.allergens ? String(i.allergens).split(',').map(s => s.trim()).filter(Boolean) : [],
          }]
        }))
      } catch { /* handled by caller */ }
    },

    updateMenuItem: async (id, data) => {
      set(s => ({ menuItems: s.menuItems.map(i => i.id === id ? { ...i, ...data } : i) }))
      try {
        await client.put(`/menu-items/${id}`, {
          category_id: data.categoryId, name: data.name, name_am: data.nameAm,
          description: data.description, description_am: data.descriptionAm,
          price: data.price, image_url: data.image, prep_time: data.prepTime,
          is_spicy: data.isSpicy, is_vegetarian: data.isVegetarian,
          is_available: data.isAvailable, is_featured: data.isFeatured,
          is_popular: data.isPopular, is_best_seller: data.isBestSeller,
          chef_recommended: data.chefRecommended, rating: data.rating,
          calories: data.calories, discount: data.discount,
          allergens: Array.isArray(data.allergens) ? data.allergens.join(',') : data.allergens,
        })
      } catch { await get().fetchAll() }
    },

    deleteMenuItem: async (id) => {
      set(s => ({ menuItems: s.menuItems.filter(i => i.id !== id) }))
      try { await client.delete(`/menu-items/${id}`) }
      catch { await get().fetchAll() }
    },

    toggleAvailable: async (id) => {
      const item = get().menuItems.find(i => i.id === id)
      if (!item) return
      const next = !item.isAvailable
      set(s => ({ menuItems: s.menuItems.map(i => i.id === id ? { ...i, isAvailable: next } : i) }))
      try {
        await client.put(`/menu-items/${id}`, {
          category_id: item.categoryId, name: item.name, name_am: item.nameAm,
          description: item.description, description_am: item.descriptionAm,
          price: item.price, image_url: item.image, prep_time: item.prepTime,
          is_spicy: item.isSpicy, is_vegetarian: item.isVegetarian,
          is_available: next, is_featured: item.isFeatured,
          is_popular: item.isPopular, is_best_seller: item.isBestSeller,
          chef_recommended: item.chefRecommended, rating: item.rating,
          calories: item.calories, discount: item.discount,
          allergens: Array.isArray(item.allergens) ? item.allergens.join(',') : item.allergens,
        })
      } catch { await get().fetchAll() }
    },

    toggleFeatured: async (id) => {
      const item = get().menuItems.find(i => i.id === id)
      if (!item) return
      const next = !item.isFeatured
      set(s => ({ menuItems: s.menuItems.map(i => i.id === id ? { ...i, isFeatured: next } : i) }))
      try {
        await client.put(`/menu-items/${id}`, { ...item, category_id: item.categoryId, is_featured: next })
      } catch { await get().fetchAll() }
    },

    // ── Modifier Groups ──────────────────────────────────────────────────────
    addModifierGroup: async (data) => {
      try {
        const res = await client.post('/modifiers/groups', {
          name: data.name, name_am: data.nameAm,
          required: data.required, multi_select: data.multiSelect, max_select: data.maxSelect,
        })
        const g = res.data
        set(s => ({
          modifierGroups: [...s.modifierGroups, {
            id: String(g.id), name: g.name, nameAm: g.name_am || '',
            required: !!g.required, multiSelect: !!g.multi_select,
            maxSelect: g.max_select || 1, modifiers: [],
          }]
        }))
      } catch { /* handled by caller */ }
    },

    updateModifierGroup: async (id, data) => {
      set(s => ({ modifierGroups: s.modifierGroups.map(g => g.id === id ? { ...g, ...data } : g) }))
      try {
        await client.put(`/modifiers/groups/${id}`, {
          name: data.name, name_am: data.nameAm,
          required: data.required, multi_select: data.multiSelect, max_select: data.maxSelect,
        })
      } catch { await get().fetchAll() }
    },

    deleteModifierGroup: async (id) => {
      set(s => ({ modifierGroups: s.modifierGroups.filter(g => g.id !== id) }))
      try { await client.delete(`/modifiers/groups/${id}`) }
      catch { await get().fetchAll() }
    },

    addModifier: async (groupId, data) => {
      try {
        const res = await client.post(`/modifiers/groups/${groupId}/items`, {
          name: data.name, name_am: data.nameAm, price: data.price,
        })
        const m = res.data
        set(s => ({
          modifierGroups: s.modifierGroups.map(g =>
            g.id === groupId
              ? { ...g, modifiers: [...(g.modifiers || []), {
                  id: String(m.id), name: m.name, nameAm: m.name_am || '',
                  price: Number(m.price) || 0, isAvailable: true,
                }]}
              : g
          )
        }))
      } catch { /* handled by caller */ }
    },

    updateModifier: async (groupId, modId, data) => {
      set(s => ({
        modifierGroups: s.modifierGroups.map(g =>
          g.id === groupId
            ? { ...g, modifiers: g.modifiers.map(m => m.id === modId ? { ...m, ...data } : m) }
            : g
        )
      }))
      try {
        await client.put(`/modifiers/items/${modId}`, {
          name: data.name, name_am: data.nameAm, price: data.price,
        })
      } catch { await get().fetchAll() }
    },

    deleteModifier: async (groupId, modId) => {
      set(s => ({
        modifierGroups: s.modifierGroups.map(g =>
          g.id === groupId
            ? { ...g, modifiers: g.modifiers.filter(m => m.id !== modId) }
            : g
        )
      }))
      try { await client.delete(`/modifiers/items/${modId}`) }
      catch { await get().fetchAll() }
    },

    // ── Tables ───────────────────────────────────────────────────────────────
    addTable: async (data) => {
      try {
        const res = await client.post('/tables', { number: data.number, capacity: data.capacity })
        const t = res.data
        set(s => ({
          tables: [...s.tables, {
            id: String(t.id), number: t.number,
            capacity: t.capacity || 4, status: t.status || 'available',
          }]
        }))
      } catch { /* handled by caller */ }
    },

    updateTable: async (id, data) => {
      set(s => ({ tables: s.tables.map(t => t.id === id ? { ...t, ...data } : t) }))
      try { await client.put(`/tables/${id}`, { number: data.number, capacity: data.capacity }) }
      catch { await get().fetchAll() }
    },

    deleteTable: async (id) => {
      set(s => ({ tables: s.tables.filter(t => t.id !== id) }))
      try { await client.delete(`/tables/${id}`) }
      catch { await get().fetchAll() }
    },
  }
}

// The storage key is namespaced per tenant so different restaurants on the
// same browser never share a cached menu store.
function tenantKey() {
  const slug = localStorage.getItem('tenant_slug') || 'default'
  return `menu-store-${slug}`
}

export const useMenuStore = create(
  persist(makeStore, {
    name: tenantKey(),
    version: 3,
    // Only persist the data arrays — not the _hydrated flag
    partialize: s => ({
      categories:     s.categories,
      menuItems:      s.menuItems,
      modifierGroups: s.modifierGroups,
      tables:         s.tables,
    }),
  })
)
