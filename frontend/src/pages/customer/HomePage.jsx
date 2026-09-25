import { useState, useMemo, useRef, useEffect } from 'react'
import { useSearchParams, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { FiChevronRight, FiStar, FiHeart, FiPlus } from 'react-icons/fi'
import Header from '../../components/customer/Header'
import MenuItemCard from '../../components/customer/MenuItemCard'
import ItemDetailDrawer from '../../components/customer/ItemDetailDrawer'
import BottomNav from '../../components/customer/BottomNav'
import {
  promotions as defaultPromos,
} from '../../data/mockData'
import { useMenuStore } from '../../store/useMenuStore'
import useAppStore from '../../store/useAppStore'
import useCartStore from '../../store/useCartStore'
import { useRestaurantStore } from '../../store/useRestaurantStore'
import toast from 'react-hot-toast'

export default function HomePage() {
  const params = useParams()
  const [searchParams] = useSearchParams()
  const setTable = useCartStore((s) => s.setTable)
  const currentTable = useCartStore((s) => s.tableNumber)

  const { t, i18n } = useTranslation()
  const language = i18n.language
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedItem, setSelectedItem] = useState(null)
  const [view, setView] = useState('grid')
  const categoryRef = useRef(null)

  // Auto-detect table parameter instantly from URL path or query string (?table=X or /menu/X)
  useEffect(() => {
    const tableFromUrl = params.tableId || searchParams.get('table') || searchParams.get('t') || searchParams.get('tableId')
    if (tableFromUrl && tableFromUrl !== currentTable) {
      setTable(tableFromUrl)
      toast.success(`Connected to Table ${tableFromUrl} 🪑`, { id: 'qr-table-toast', duration: 3000 })
    }
  }, [params.tableId, searchParams, currentTable, setTable])

  const { info: restaurantInfo, fetchRestaurant } = useRestaurantStore()
  const { categories: storeCats, menuItems: storeItems, fetchCustomerMenu } = useMenuStore()

  const tenantSlug = params.tenantSlug || null

  useEffect(() => {
    if (tenantSlug) {
      localStorage.setItem('tenant_slug', tenantSlug)
      fetchRestaurant(tenantSlug)
      fetchCustomerMenu(tenantSlug)
    } else {
      fetchRestaurant('abc-restaurant')
      fetchCustomerMenu('abc-restaurant')
    }
  }, [tenantSlug, fetchRestaurant, fetchCustomerMenu])

  const categories = useMemo(() => [{ id: 'all', name: 'All', nameAm: 'ሁሉም', icon: '🍽️', color: '#e85d04' }, ...storeCats.filter(c => c.isActive)], [storeCats])
  const menuItems = useMemo(() => storeItems.filter(i => i.isAvailable), [storeItems])

  const promotions = useMemo(() => {
    if (!tenantSlug || tenantSlug === 'abc-restaurant' || tenantSlug === 'five-stop') {
      return defaultPromos
    }
    return [
      {
        id: 1,
        title: `Welcome to ${restaurantInfo.name}!`,
        titleAm: `እንኳን ወደ ${restaurantInfo.nameAm || restaurantInfo.name} በደህና መጡ!`,
        subtitle: restaurantInfo.tagline || 'Experience our freshly prepared special dishes.',
        subtitleAm: 'ትኩስ እና ጣፋጭ ምግቦችን ከእኛ ጋር ይደሰቱ',
        icon: '🍽️',
        bg: 'from-amber-500 to-orange-600',
      },
      {
        id: 2,
        title: 'Special Menu Selection',
        titleAm: 'ልዩ የምግብ ዝርዝር',
        subtitle: 'Crafted with premium ingredients just for you.',
        subtitleAm: 'ከጥራት ጋር የተዘጋጀ ምርጥ ምግብ',
        icon: '⭐',
        bg: 'from-rose-500 to-red-600',
      }
    ]
  }, [tenantSlug, restaurantInfo])

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchCat = selectedCategory === 'all' || item.categoryId === selectedCategory
      const matchSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.nameAm.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      return matchCat && matchSearch
    })
  }, [menuItems, selectedCategory, searchQuery])


  const featuredItems  = menuItems.filter((i) => i.isFeatured)
  const bestSellers    = menuItems.filter((i) => i.isBestSeller)
  const chefRecommends = menuItems.filter((i) => i.chefRecommended)

  const activeCatLabel =
    selectedCategory === 'all'
      ? t('allCategories')
      : language === 'am'
      ? categories.find((c) => c.id === selectedCategory)?.nameAm
      : categories.find((c) => c.id === selectedCategory)?.name

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        view={view}
        onViewChange={setView}
      />

      <main className="max-w-2xl mx-auto px-4 pb-10">

        {/* ── Cover Image ── */}
        {!searchQuery && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative h-52 rounded-3xl overflow-hidden mt-4 mb-5 shadow-xl"
          >
            <img
              src={restaurantInfo.coverImage}
              alt={restaurantInfo.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h2 className="text-white text-2xl font-black mb-0.5 drop-shadow">
                {restaurantInfo.name}
              </h2>
              <p className="text-white/80 text-sm mb-2">{restaurantInfo.tagline}</p>
              <div className="flex items-center gap-3 text-white/70 text-xs flex-wrap">
                <span className="flex items-center gap-1 bg-white/15 backdrop-blur px-2.5 py-1 rounded-full">
                  ⭐ {restaurantInfo.rating} · {restaurantInfo.reviewCount} reviews
                </span>
                <span className="flex items-center gap-1 bg-white/15 backdrop-blur px-2.5 py-1 rounded-full">
                  🕒 {restaurantInfo.hours}
                </span>
                <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold ${
                  restaurantInfo.openNow
                    ? 'bg-green-500/80 text-white'
                    : 'bg-red-500/80 text-white'
                }`}>
                  {restaurantInfo.openNow ? '🟢 Open Now' : '🔴 Closed'}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Promotions Carousel ── */}
        {!searchQuery && promotions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mb-5"
          >
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {promotions.map((promo, idx) => (
                <motion.div
                  key={promo.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 + idx * 0.06 }}
                  whileHover={{ scale: 1.02 }}
                  className={`min-w-[260px] bg-gradient-to-br ${promo.color} rounded-2xl p-4 text-white shadow-lg cursor-pointer flex-shrink-0`}
                >
                  <div className="text-3xl mb-2">{promo.emoji}</div>
                  <h3 className="font-black text-base mb-0.5">
                    {language === 'am' ? promo.titleAm : promo.title}
                  </h3>
                  <p className="text-white/85 text-xs">{promo.subtitle}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Category Nav ── */}
        {!searchQuery && (
          <motion.div
            ref={categoryRef}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="sticky top-14 z-40 bg-gray-50 dark:bg-gray-950 py-3 -mx-4 px-4 mb-5"
            id="category-nav"
          >
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {categories.map((cat) => {
                const isActive = selectedCategory === cat.id
                return (
                  <motion.button
                    key={cat.id}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl font-semibold text-sm whitespace-nowrap transition-all flex-shrink-0 ${
                      isActive
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-200 dark:shadow-orange-900/40'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-700'
                    }`}
                  >
                    <span className="text-base">{cat.icon}</span>
                    <span>{language === 'am' ? cat.nameAm : cat.name}</span>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* ── Featured – horizontal scroll strip ── */}
        {!searchQuery && selectedCategory === 'all' && featuredItems.length > 0 && (
          <HorizontalStrip
            title={`🌟 ${t('todaySpecial')}`}
            items={featuredItems.slice(0, 6)}
            onItemClick={setSelectedItem}
          />
        )}

        {/* ── Best Sellers strip ── */}
        {!searchQuery && selectedCategory === 'all' && bestSellers.length > 0 && (
          <HorizontalStrip
            title={`🔥 ${t('bestSellers')}`}
            items={bestSellers.slice(0, 6)}
            onItemClick={setSelectedItem}
          />
        )}

        {/* ── Chef Recommends strip ── */}
        {!searchQuery && selectedCategory === 'all' && chefRecommends.length > 0 && (
          <HorizontalStrip
            title={`👨‍🍳 ${t('chefRecommends')}`}
            items={chefRecommends}
            onItemClick={setSelectedItem}
          />
        )}

        {/* ── Main Menu Section ── */}
        <div className="mb-8">
          {/* Section header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white leading-tight">
                {searchQuery ? `Search results` : activeCatLabel}
              </h2>
              {searchQuery && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  for &ldquo;{searchQuery}&rdquo; · {filteredItems.length} found
                </p>
              )}
              {!searchQuery && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
                </p>
              )}
            </div>
          </div>

          {/* Items */}
          {filteredItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <p className="text-5xl mb-4">🔍</p>
              <p className="text-gray-600 dark:text-gray-300 font-semibold mb-1">{t('noResults')}</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm">{t('tryDifferentSearch')}</p>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className={
                  view === 'grid'
                    ? 'grid grid-cols-2 gap-3'
                    : 'flex flex-col gap-3'
                }
              >
                {filteredItems.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                  >
                    <MenuItemCard
                      item={item}
                      view={view}
                      onClick={() => setSelectedItem(item)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>

      <ItemDetailDrawer
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />

      <BottomNav
        onCategoryTab={() => {
          categoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }}
      />
    </div>
  )
}

/* ── Horizontal scroll strip for featured / best sellers ── */
function HorizontalStrip({ title, items, onItemClick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-7"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-black text-gray-900 dark:text-white">{title}</h2>
        <button className="flex items-center gap-1 text-xs text-orange-500 font-semibold hover:underline">
          See all <FiChevronRight size={13} />
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
        {items.map((item, idx) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="flex-shrink-0 w-44"
          >
            <StripCard item={item} onItemClick={onItemClick} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

/* ── Compact card used in the horizontal strip ── */
function StripCard({ item, onItemClick }) {
  const { i18n } = useTranslation()
  const language = i18n.language
  const { favorites, toggleFavorite } = useAppStore()
  const isFav = favorites.includes(item.id)

  return (
    <motion.div
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onItemClick(item)}
      className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer group"
    >
      {/* Image */}
      <div className="relative h-28 bg-gray-100 dark:bg-gray-700 overflow-hidden">
        {item.image
          ? <img src={item.image} alt={item.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center text-4xl">🍽️</div>
        }
        {item.discount > 0 && (
          <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
            -{item.discount}%
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id) }}
          className="absolute top-1.5 right-1.5 w-6 h-6 bg-white/90 dark:bg-gray-900/90 rounded-full flex items-center justify-center shadow"
        >
          <FiHeart size={11} className={isFav ? 'fill-red-500 stroke-red-500' : 'stroke-gray-500'} />
        </button>
      </div>

      {/* Body */}
      <div className="p-2.5">
        <h4 className="font-bold text-gray-900 dark:text-white text-xs line-clamp-1 mb-0.5">
          {language === 'am' ? item.nameAm : item.name}
        </h4>
        <div className="flex items-center gap-1 mb-2">
          <FiStar size={10} className="fill-amber-400 stroke-amber-400" />
          <span className="text-[10px] text-gray-600 dark:text-gray-300 font-semibold">{item.rating}</span>
          {item.prepTime && (
            <span className="text-[10px] text-gray-400">· {item.prepTime}m</span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-extrabold text-orange-500">{item.price.toFixed(0)} ETB</span>
          {item.isAvailable ? (
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={(e) => { e.stopPropagation(); onItemClick(item) }}
              className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center text-white shadow-md shadow-orange-200 dark:shadow-none hover:bg-orange-600 transition-colors"
            >
              <FiPlus size={14} strokeWidth={2.5} />
            </motion.button>
          ) : (
            <span className="text-[9px] text-red-400">N/A</span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// imports needed inside StripCard are already at the top of the file
