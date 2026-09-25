import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  FiHeart, FiClock, FiStar, FiGlobe, FiMoon, FiSun,
  FiWifi, FiPhone, FiMapPin, FiChevronRight, FiCamera, FiX, FiTrash2, FiUpload,
} from 'react-icons/fi'
import useAppStore from '../../store/useAppStore'
import useCartStore from '../../store/useCartStore'
import { useOrderStore } from '../../store/useOrderStore'
import { useRestaurantStore } from '../../store/useRestaurantStore'
import BottomNav from '../../components/customer/BottomNav'
import RateExperienceModal from '../../components/customer/RateExperienceModal'
import toast from 'react-hot-toast'

const avatarOptions = [
  '', '😎', '🤗', '🥳', '🤩', '😇', '🙂', '😋',
  '👨', '👩', '🧑', '👦', '👧', '�', '�', '👴',
  '�', '�👨‍🦱', '👩‍🦰', '🧑‍🦳', '🍕', '🍔', '🍜', '🍣',
  '🌟', '⭐', '🎉', '💎', '🔥', '✨', '🎊', '🏆',
]

export default function ProfilePage() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const params = useParams()
  const tenantSlug = params.tenantSlug || null
  const { darkMode, toggleDarkMode, language, setLanguage, favorites, profilePhoto, setProfilePhoto } = useAppStore()
  const tableNumber = useCartStore(s => s.tableNumber)
  const { orders } = useOrderStore()
  const { info: restaurantInfo, fetchRestaurant } = useRestaurantStore()

  useEffect(() => {
    fetchRestaurant(tenantSlug)
  }, [tenantSlug, fetchRestaurant])


  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [showRateModal,  setShowRateModal]  = useState(false)
  const [location, setLocation] = useState({ loading: true, city: null, country: null, error: null })
  const [online] = useState(navigator.onLine)
  const fileInputRef = useRef(null)

  const lastOrder = orders?.filter(o => o.phone)?.at(0)
  const customerPhone = lastOrder?.phone || null
  const customerName = lastOrder?.customerName || null

  const handleLang = (lang) => { setLanguage(lang); i18n.changeLanguage(lang) }

  // ── Photo handlers ──────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setProfilePhoto(ev.target.result)
      setShowPhotoModal(false)
      toast.success('Profile photo updated!')
    }
    reader.readAsDataURL(file)
  }
  const handleAvatarSelect = (emoji) => {
    setProfilePhoto(emoji)
    setShowPhotoModal(false)
    toast.success('Avatar updated!')
  }
  const handleRemovePhoto = () => {
    setProfilePhoto(null)
    setShowPhotoModal(false)
    toast.success('Photo removed')
  }
  const isImageUrl = profilePhoto?.startsWith('data:')
  const isEmoji = profilePhoto && !isImageUrl
  // ── Geolocation ─────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation({ loading: false, city: 'Not supported', country: '', error: true }); return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
          const data = await res.json()
          const city = data.address?.city || data.address?.town || data.address?.village || 'Unknown'
          setLocation({ loading: false, city, country: data.address?.country || '', error: false })
        } catch {
          setLocation({ loading: false, city: 'Location detected', country: '', error: false })
        }
      },
      () => setLocation({ loading: false, city: 'Permission denied', country: '', error: true }),
      { timeout: 8000 }
    )
  }, [])

  const myOrders = (orders || []).filter(o =>
    customerPhone ? o.phone === customerPhone : o.tableNumber === tableNumber
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">

      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-orange-500 to-red-600 pt-12 pb-16 px-5 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="w-40 h-40 bg-white rounded-full absolute -top-10 -left-10" />
          <div className="w-32 h-32 bg-white rounded-full absolute -bottom-8 -right-8" />
        </div>

        {/* Avatar with camera button */}
        <div className="relative w-24 h-24 mx-auto mb-3">
          <div className="w-24 h-24 bg-white/25 backdrop-blur rounded-3xl flex items-center justify-center shadow-xl border-2 border-white/40 overflow-hidden">
            {isImageUrl ? (
              <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
            ) : isEmoji ? (
              <span className="text-5xl">{profilePhoto}</span>
            ) : (
              <span className="text-5xl">{customerName ? customerName.charAt(0).toUpperCase() : '👤'}</span>
            )}
          </div>
          {/* Camera button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowPhotoModal(true)}
            className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-orange-500"
          >
            <FiCamera size={14} className="text-orange-500" />
          </motion.button>
        </div>

        <h1 className="text-white text-xl font-black">{customerName || 'Guest Customer'}</h1>
        <p className="text-white/75 text-sm mt-0.5">{customerPhone || 'No phone registered'}</p>
        {tableNumber && (
          <div className="inline-block bg-white/20 backdrop-blur rounded-full px-4 py-1.5 mt-3">
            <span className="text-white text-sm font-semibold">🪑 Table {tableNumber}</span>
          </div>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="max-w-2xl mx-auto px-4 -mt-8 mb-5">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-700">
          {[
            { icon: '❤️', label: 'Favorites', value: favorites.length },
            { icon: '📦', label: 'Orders', value: myOrders.length },
            { icon: '⭐', label: 'Rating', value: restaurantInfo.rating },
          ].map((s, i) => (
            <div key={i} className="flex flex-col items-center py-4">
              <span className="text-2xl mb-1">{s.icon}</span>
              <span className="text-lg font-black text-gray-900 dark:text-white">{s.value}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 space-y-4">

        {/* ── My Info ── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <p className="px-5 pt-4 pb-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">My Info</p>
          <InfoRow icon={FiPhone} color="text-green-500" label="My Phone">
            <span className={customerPhone ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-400 italic text-sm'}>
              {customerPhone || 'N/A — order to save your number'}
            </span>
          </InfoRow>
          <InfoRow icon={FiMapPin} color="text-blue-500" label="My Location">
            {location.loading ? (
              <span className="flex items-center gap-2 text-gray-400 text-sm">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full" />
                Detecting...
              </span>
            ) : location.error ? (
              <span className="text-gray-400 text-sm italic">{location.city}</span>
            ) : (
              <div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm">{location.city}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{location.country}</p>
              </div>
            )}
          </InfoRow>
        </div>

        {/* ── Quick Actions ── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <p className="px-5 pt-4 pb-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Quick Actions</p>
          {[
            { icon: FiCamera, label: 'Change Profile Photo', sub: profilePhoto ? 'Photo set — tap to change' : 'Upload or choose avatar', color: 'text-orange-500', onClick: () => setShowPhotoModal(true) },
            { icon: FiHeart, label: 'My Favorites', sub: `${favorites.length} saved items`, color: 'text-red-500', onClick: () => navigate('/menu') },
            { icon: FiClock, label: 'My Orders', sub: `${myOrders.length} orders placed`, color: 'text-blue-500', onClick: () => navigate('/order-history') },
            { icon: FiStar, label: 'Rate Experience', sub: 'Share your feedback', color: 'text-amber-500', onClick: () => setShowRateModal(true) },
          ].map((item, i) => (
            <motion.button key={i} whileTap={{ scale: 0.98 }} onClick={item.onClick}
              className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-t border-gray-50 dark:border-gray-700">
              <div className={`w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center ${item.color}`}>
                <item.icon size={18} />
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-gray-900 dark:text-white text-sm">{item.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.sub}</p>
              </div>
              <FiChevronRight size={16} className="text-gray-400" />
            </motion.button>
          ))}
        </div>

        {/* ── Preferences ── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <p className="px-5 pt-4 pb-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Preferences</p>
          {/* Dark Mode */}
          <div className="flex items-center gap-4 px-5 py-3.5 border-t border-gray-50 dark:border-gray-700">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300">
              {darkMode ? <FiSun size={18} /> : <FiMoon size={18} />}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 dark:text-white text-sm">{darkMode ? 'Light Mode' : 'Dark Mode'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Currently {darkMode ? 'dark' : 'light'}</p>
            </div>
            <button onClick={toggleDarkMode}
              className={`relative w-12 h-6 rounded-full transition-colors ${darkMode ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${darkMode ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>
          {/* Language */}
          <div className="flex items-center gap-4 px-5 py-3.5 border-t border-gray-50 dark:border-gray-700">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300">
              <FiGlobe size={18} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 dark:text-white text-sm">Language</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{language === 'en' ? 'English' : 'አማርኛ'}</p>
            </div>
            <div className="flex gap-2">
              {[{ code: 'en', flag: '🇺🇸' }, { code: 'am', flag: '🇪🇹' }].map(l => (
                <button key={l.code} onClick={() => handleLang(l.code)}
                  className={`w-10 h-10 rounded-xl text-lg transition-all ${language === l.code ? 'bg-orange-500 shadow-md scale-110' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  {l.flag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Restaurant Info ── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <p className="px-5 pt-4 pb-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Restaurant Info</p>
          <InfoRow icon={FiMapPin} color="text-blue-500" label="Address">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{restaurantInfo.address}</span>
          </InfoRow>
          <InfoRow icon={FiPhone} color="text-green-500" label="Restaurant Phone">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{restaurantInfo.phone}</span>
          </InfoRow>
          <InfoRow icon={FiWifi} color="text-purple-500" label="WiFi Password">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${online ? 'text-green-500' : 'text-red-500'}`}>
                {online ? '● Connected' : '○ Offline'}
              </span>
              <span className="text-sm font-mono text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-lg">
                {restaurantInfo.wifi}
              </span>
            </div>
          </InfoRow>
          <InfoRow icon={FiClock} color="text-orange-500" label="Working Hours">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{restaurantInfo.hours}</span>
          </InfoRow>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 pb-4">
          {restaurantInfo.name} · Digital Menu v1.0
        </p>
      </div>

      {/* ── Rate Experience Modal ── */}
      <RateExperienceModal
        open={showRateModal}
        onClose={() => setShowRateModal(false)}
        orderRef={myOrders[0]?.id || ''}
        tableNumber={tableNumber}
        customerName={customerName}
        phone={customerPhone}
        language={language}
      />

      {/* ── Photo Modal ── */}
      <AnimatePresence>
        {showPhotoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-end justify-center"
            onClick={() => setShowPhotoModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl p-6 pb-10 shadow-2xl"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Profile Photo</h3>
                <button onClick={() => setShowPhotoModal(false)}
                  className="w-9 h-9 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                  <FiX size={18} className="text-gray-600 dark:text-gray-300" />
                </button>
              </div>

              {/* Current photo preview */}
              {profilePhoto && (
                <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl mb-5">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white dark:bg-gray-700 flex items-center justify-center border-2 border-orange-200 dark:border-orange-800 flex-shrink-0">
                    {isImageUrl
                      ? <img src={profilePhoto} alt="Current" className="w-full h-full object-cover" />
                      : <span className="text-4xl">{profilePhoto}</span>
                    }
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">Current photo</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{isImageUrl ? 'Custom photo' : 'Emoji avatar'}</p>
                  </div>
                  <button onClick={handleRemovePhoto}
                    className="flex items-center gap-1.5 text-xs text-red-500 font-semibold bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl">
                    <FiTrash2 size={13} /> Remove
                  </button>
                </div>
              )}

              {/* Upload from gallery/camera */}
              <div className="mb-5">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Upload Photo</p>
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { fileInputRef.current.accept = 'image/*'; fileInputRef.current.capture = undefined; fileInputRef.current.click() }}
                    className="flex flex-col items-center gap-2 p-4 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-2xl"
                  >
                    <FiUpload size={24} className="text-orange-500" />
                    <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">From Gallery</span>
                    <span className="text-xs text-orange-500/70">Choose existing photo</span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { fileInputRef.current.accept = 'image/*'; fileInputRef.current.setAttribute('capture', 'environment'); fileInputRef.current.click() }}
                    className="flex flex-col items-center gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-2xl"
                  >
                    <FiCamera size={24} className="text-blue-500" />
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">Take Photo</span>
                    <span className="text-xs text-blue-500/70">Use camera</span>
                  </motion.button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Emoji avatars */}
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">Choose Avatar</p>
                <div className="grid grid-cols-8 gap-2">
                  {avatarOptions.map((emoji) => (
                    <motion.button
                      key={emoji}
                      whileTap={{ scale: 0.85 }}
                      onClick={() => handleAvatarSelect(emoji)}
                      className={`w-10 h-10 rounded-xl text-2xl flex items-center justify-center transition-all ${
                        profilePhoto === emoji
                          ? 'bg-orange-500 shadow-lg scale-110'
                          : 'bg-gray-100 dark:bg-gray-800 hover:bg-orange-100 dark:hover:bg-orange-900/30'
                      }`}
                    >
                      {emoji}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  )
}

function InfoRow({ icon: Icon, color, label, children }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-t border-gray-50 dark:border-gray-700">
      <div className={`w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
        {children}
      </div>
    </div>
  )
}
