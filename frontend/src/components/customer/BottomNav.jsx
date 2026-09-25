import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiHome, FiGrid, FiShoppingBag, FiUser } from 'react-icons/fi'
import useCartStore from '../../store/useCartStore'

export default function BottomNav({ onCategoryTab }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const items = useCartStore(s => s.items)
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0)

  const pathMatch = pathname.match(/^\/r\/([^\/]+)/)
  const tenantPrefix = pathMatch ? `/r/${pathMatch[1]}` : ''

  const getActive = () => {
    if (pathname.endsWith('/cart')) return 'orders'
    if (pathname.endsWith('/profile')) return 'profile'
    if (pathname.includes('/categories')) return 'categories'
    return 'home'
  }
  const active = getActive()

  const tabs = [
    { id: 'home',       icon: FiHome,        label: 'Home',       action: () => navigate(tenantPrefix ? `${tenantPrefix}/menu` : '/menu') },
    { id: 'categories', icon: FiGrid,        label: 'Categories', action: () => navigate(tenantPrefix ? `${tenantPrefix}/categories` : '/categories') },
    { id: 'orders',     icon: FiShoppingBag, label: 'Orders',     action: () => navigate(tenantPrefix ? `${tenantPrefix}/cart` : '/cart'), badge: totalItems },
    { id: 'profile',    icon: FiUser,        label: 'Profile',    action: () => navigate(tenantPrefix ? `${tenantPrefix}/profile` : '/profile') },
  ]


  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 safe-bottom shadow-2xl">
      <div className="max-w-2xl mx-auto flex items-center justify-around h-16 px-2">
        {tabs.map(tab => {
          const isActive = active === tab.id
          return (
            <motion.button
              key={tab.id}
              whileTap={{ scale: 0.88 }}
              onClick={tab.action}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative"
            >
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute top-1 inset-x-2 bottom-1 bg-orange-50 dark:bg-orange-900/20 rounded-2xl -z-0"
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                />
              )}

              {/* Icon */}
              <div className="relative z-10">
                <tab.icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  className={isActive ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'}
                />
                {tab.badge > 0 && (
                  <motion.span
                    key={tab.badge}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow"
                  >
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </motion.span>
                )}
              </div>

              {/* Label */}
              <span className={`text-[10px] font-semibold z-10 transition-colors ${isActive ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'}`}>
                {tab.label}
              </span>
            </motion.button>
          )
        })}
      </div>
    </nav>
  )
}
