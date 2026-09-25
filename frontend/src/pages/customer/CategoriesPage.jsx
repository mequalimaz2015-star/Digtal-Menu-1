import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { FiArrowLeft, FiChevronRight } from 'react-icons/fi'
import { useMenuStore } from '../../store/useMenuStore'
import MenuItemCard from '../../components/customer/MenuItemCard'
import ItemDetailDrawer from '../../components/customer/ItemDetailDrawer'
import BottomNav from '../../components/customer/BottomNav'

export default function CategoriesPage() {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const navigate = useNavigate()
  const params = useParams()
  const tenantSlug = params.tenantSlug || null
  const { categories, menuItems, fetchCustomerMenu } = useMenuStore()
  const [selectedCat, setSelectedCat] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [view] = useState('grid')

  useEffect(() => {
    fetchCustomerMenu(tenantSlug)
  }, [tenantSlug, fetchCustomerMenu])


  const activeCategories = useMemo(() =>
    categories.filter(c => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories]
  )

  const catItems = useMemo(() => {
    if (!selectedCat) return []
    return menuItems.filter(i =>
      (i.categoryId === selectedCat.id || String(i.categoryId) === String(selectedCat.id)) &&
      i.isAvailable
    )
  }, [selectedCat, menuItems])

  // Full category grid view
  if (!selectedCat) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800">
          <div className="max-w-2xl mx-auto px-4 flex items-center gap-3 h-14">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex-1">
              🍽️ Categories
            </h1>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {activeCategories.length} categories
            </span>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {activeCategories.map((cat, idx) => {
              const count = menuItems.filter(i =>
                (i.categoryId === cat.id || String(i.categoryId) === String(cat.id)) && i.isAvailable
              ).length

              return (
                <motion.button
                  key={cat.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSelectedCat(cat)}
                  className="relative overflow-hidden rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 dark:border-gray-700"
                  style={{ background: `linear-gradient(135deg, ${cat.color}20, ${cat.color}40)` }}
                >
                  {/* Background pattern */}
                  <div className="absolute -right-4 -bottom-4 text-8xl opacity-15">
                    {cat.icon}
                  </div>

                  <div className="relative p-5 text-left">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-3 shadow-sm"
                      style={{ backgroundColor: cat.color + '30' }}
                    >
                      {cat.icon}
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base leading-tight">
                      {language === 'am' ? cat.nameAm : cat.name}
                    </h3>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {count} {count === 1 ? 'item' : 'items'}
                      </p>
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: cat.color }}
                      >
                        <FiChevronRight size={13} className="text-white" />
                      </div>
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>

        <BottomNav />
      </div>
    )
  }

  // Category items view
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
      {/* Header */}
      <div
        className="sticky top-0 z-30 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800"
        style={{ backgroundColor: selectedCat.color + '15' }}
      >
        <div className="max-w-2xl mx-auto px-4 flex items-center gap-3 h-14">
          <button
            onClick={() => setSelectedCat(null)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <FiArrowLeft size={20} />
          </button>
          <span className="text-xl">{selectedCat.icon}</span>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex-1">
            {language === 'am' ? selectedCat.nameAm : selectedCat.name}
          </h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {catItems.length} items
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5">
        {catItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <p className="text-5xl mb-4">{selectedCat.icon}</p>
            <p className="font-semibold text-gray-600 dark:text-gray-300 mb-1">
              No items in this category
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Check back later for updates
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 gap-3"
          >
            {catItems.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <MenuItemCard
                  item={item}
                  view="grid"
                  onClick={() => setSelectedItem(item)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Item Detail Drawer */}
      <ItemDetailDrawer
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />

      <BottomNav />
    </div>
  )
}
