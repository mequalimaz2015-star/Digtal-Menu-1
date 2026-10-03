import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTenantNav } from '../../hooks/useTenantNav'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  FiShoppingCart, FiMoon, FiSun, FiGlobe,
  FiSearch, FiBell, FiGrid, FiList,
} from 'react-icons/fi'
import useCartStore from '../../store/useCartStore'
import useAppStore from '../../store/useAppStore'
import { useRestaurantStore } from '../../store/useRestaurantStore'
import WaiterCallModal from './WaiterCallModal'
import toast from 'react-hot-toast'

export default function Header({
  onSearchChange,
  searchQuery,
  view = 'grid',
  onViewChange,
}) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { tNavigate } = useTenantNav()
  const { darkMode, toggleDarkMode, language, setLanguage } = useAppStore()
  const { info: restaurant } = useRestaurantStore()
  const items = useCartStore((s) => s.items)
  const tableNumber = useCartStore((s) => s.tableNumber)
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0)
  const [showLangMenu, setShowLangMenu] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const handleLangSwitch = (lang) => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
    setShowLangMenu(false)
  }

  const [waiterCalledToast, setWaiterCalledToast] = useState(false)
  const [showWaiterModal, setShowWaiterModal]     = useState(false)
  const [waiterCooldown, setWaiterCooldown]       = useState(0)
  const cooldownRef                               = useRef(null)

  const handleCallWaiter = () => {
    if (waiterCooldown > 0) return
    setShowWaiterModal(true)
  }

  // Called by WaiterCallModal after successful submit
  const handleWaiterCallSent = () => {
    setShowWaiterModal(false)
    setWaiterCalledToast(true)
    setTimeout(() => setWaiterCalledToast(false), 4000)
    toast.custom((tItem) => (
      <div className={`flex items-center gap-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-3 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 font-semibold text-sm ${tItem.visible ? 'animate-enter' : 'animate-leave'}`}>
        <span className="text-xl">🛎️</span>
        <span>{t('waiterCalled') || 'Waiter has been called!'}</span>
      </div>
    ), { duration: 4000 })
    // Start 15-second cooldown
    setWaiterCooldown(15)
    clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setWaiterCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  const toggleView = () => {
    onViewChange?.(view === 'grid' ? 'list' : 'grid')
  }

  return (
    <>
    <header className="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800">
      <div className="max-w-2xl mx-auto px-4">

        {/* ── Main row ── */}
        <div className="flex items-center justify-between h-14">

          {/* Logo + Name */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-xl overflow-hidden shadow-md shadow-orange-200 dark:shadow-none bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-lg">
              {restaurant?.logo ? (
                <img
                  src={restaurant.logo}
                  alt={restaurant.name || 'Logo'}
                  className="w-full h-full object-cover"
                  onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                />
              ) : null}
              <span
                className="w-full h-full flex items-center justify-center text-lg"
                style={{ display: restaurant?.logo ? 'none' : 'flex' }}
              >
                🍽️
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate">
                {restaurant?.name || 'MEGA Digital Menu'}
              </h1>
              {tableNumber && (
                <span className="text-xs text-orange-500 font-semibold">
                  🪑 {t('table')} {tableNumber}
                </span>
              )}
            </div>
          </div>

          {/* Action icons */}
          <div className="flex items-center gap-0.5 shrink-0">

            {/* Search */}
            <IconBtn onClick={() => setSearchOpen(!searchOpen)} active={searchOpen}>
              <FiSearch size={18} />
            </IconBtn>

            {/* Call waiter — with 15-second cooldown countdown */}
            <div className="relative">
              <motion.button
                whileTap={waiterCooldown > 0 ? {} : { scale: 0.88 }}
                onClick={handleCallWaiter}
                title={waiterCooldown > 0 ? `Wait ${waiterCooldown}s before calling again` : 'Call waiter'}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors relative overflow-hidden ${
                  waiterCooldown > 0
                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-400 cursor-not-allowed'
                    : waiterCalledToast
                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-500'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {/* Countdown ring overlay */}
                {waiterCooldown > 0 && (
                  <svg
                    className="absolute inset-0 w-full h-full -rotate-90"
                    viewBox="0 0 36 36"
                  >
                    <circle
                      cx="18" cy="18" r="16"
                      fill="none"
                      stroke="currentColor"
                      strokeOpacity="0.2"
                      strokeWidth="2"
                    />
                    <motion.circle
                      cx="18" cy="18" r="16"
                      fill="none"
                      stroke="#f97316"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 16}`}
                      strokeDashoffset={`${2 * Math.PI * 16 * (1 - waiterCooldown / 15)}`}
                      style={{ transition: 'stroke-dashoffset 1s linear' }}
                    />
                  </svg>
                )}
                <FiBell size={18} />
                {/* Countdown number badge */}
                {waiterCooldown > 0 && (
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[9px] font-black rounded-full flex items-center justify-center leading-none">
                    {waiterCooldown}
                  </span>
                )}
              </motion.button>

              <AnimatePresence>
                {waiterCalledToast && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.9 }}
                    className="absolute right-0 top-11 z-50 flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-bold rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 whitespace-nowrap"
                  >
                    <span className="text-base animate-bounce">🛎️</span>
                    <span>{t('waiterCalled') || 'Waiter has been called!'}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Dark mode */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={toggleDarkMode}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 relative overflow-hidden"
            >
              <AnimatePresence mode="wait">
                {darkMode ? (
                  <motion.span
                    key="sun"
                    initial={{ rotate: -90, scale: 0, opacity: 0 }}
                    animate={{ rotate: 0, scale: 1, opacity: 1 }}
                    exit={{ rotate: 90, scale: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 flex items-center justify-center text-amber-400"
                  >
                    <FiSun size={18} />
                  </motion.span>
                ) : (
                  <motion.span
                    key="moon"
                    initial={{ rotate: 90, scale: 0, opacity: 0 }}
                    animate={{ rotate: 0, scale: 1, opacity: 1 }}
                    exit={{ rotate: -90, scale: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <FiMoon size={18} />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Language */}
            <div className="relative">
              <IconBtn onClick={() => setShowLangMenu(!showLangMenu)} active={showLangMenu}>
                <FiGlobe size={18} />
              </IconBtn>

              <AnimatePresence>
                {showLangMenu && (
                  <>
                    {/* backdrop */}
                    <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-11 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 min-w-[130px]"
                    >
                      {[
                        { code: 'en', flag: '🇺🇸', label: 'English' },
                        { code: 'am', flag: '🇪🇹', label: 'አማርኛ' },
                      ].map((l) => (
                        <button
                          key={l.code}
                          onClick={() => handleLangSwitch(l.code)}
                          className={`w-full flex items-center gap-2.5 px-4 py-3 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
                            language === l.code
                              ? 'text-orange-500 font-semibold bg-orange-50 dark:bg-orange-900/20'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <span className="text-base">{l.flag}</span>
                          {l.label}
                          {language === l.code && (
                            <span className="ml-auto w-2 h-2 bg-orange-500 rounded-full" />
                          )}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* ── View toggle (Grid ↔ List) ── */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={toggleView}
              title={view === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 relative"
            >
              <AnimatePresence mode="wait">
                {view === 'grid' ? (
                  <motion.span
                    key="list-icon"
                    initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.18 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <FiList size={18} />
                  </motion.span>
                ) : (
                  <motion.span
                    key="grid-icon"
                    initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.18 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <FiGrid size={18} />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Cart */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => tNavigate('/cart')}
              className="relative w-9 h-9 ml-0.5 rounded-xl flex items-center justify-center bg-orange-500 text-white shadow-md shadow-orange-200 dark:shadow-none hover:bg-orange-600 transition-colors"
            >
              <FiShoppingCart size={18} />
              <AnimatePresence>
                {totalItems > 0 && (
                  <motion.span
                    key={totalItems}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow"
                  >
                    {totalItems > 9 ? '9+' : totalItems}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>

        {/* ── Search bar (slides down) ── */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden pb-3"
            >
              <div className="relative">
                <FiSearch
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  size={15}
                />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-orange-400 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => onSearchChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none"
                  >
                    ×
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>

    {/* Waiter Call Modal — rendered outside header so it overlays everything */}
    <WaiterCallModal
      open={showWaiterModal}
      onClose={handleWaiterCallSent}
      tableNumber={tableNumber}
      language={language}
    />
    </>
  )
}

/* Small reusable icon button */
function IconBtn({ onClick, active, children }) {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
        active
          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-500'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      {children}
    </motion.button>
  )
}
