import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import useCartStore from '../../store/useCartStore'

export default function SplashScreen() {
  const navigate = useNavigate()
  const params = useParams()
  const { t } = useTranslation()
  const setTable = useCartStore((s) => s.setTable)
  const [progress, setProgress] = useState(0)

  // Extract table from path (/menu/:tableId or /table/:tableId) or query string (?table=X or ?t=X)
  const queryParams = new URLSearchParams(window.location.search)
  const tableId = params.tableId || queryParams.get('table') || queryParams.get('t') || queryParams.get('tableId')

  useEffect(() => {
    if (tableId) {
      setTable(tableId)
    }

    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(timer); return 100 }
        return p + 5
      })
    }, 30)

    const nav = setTimeout(() => {
      navigate('/menu', { replace: true })
    }, 800)

    return () => { clearInterval(timer); clearTimeout(nav) }
  }, [tableId, navigate, setTable])

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-600 via-red-600 to-orange-800 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background circles */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/2 translate-y-1/2" />
      <div className="absolute top-1/3 right-1/4 w-32 h-32 bg-white/5 rounded-full" />

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="text-center z-10 px-8"
      >
        {/* Logo */}
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="w-28 h-28 bg-white rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl"
        >
          <span className="text-5xl">🍽️</span>
        </motion.div>

        {/* Restaurant Name */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-4xl font-bold text-white mb-2 tracking-tight"
        >
          MEGA Digital Menu
        </motion.h1>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-orange-200 text-lg mb-2"
        >
          ★ Fine Dining & Fast Delivery
        </motion.p>

        {tableId && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="inline-block bg-white/20 backdrop-blur-sm rounded-full px-5 py-2 mt-2 mb-6"
          >
            <span className="text-white font-semibold">🪑 Table {tableId}</span>
          </motion.div>
        )}

        {/* Welcome message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mt-6 mb-10"
        >
          <p className="text-white/80 text-base">{t('welcome')} MEGA Digital Menu</p>
          <p className="text-white/60 text-sm mt-1">{t('preparingMenu')}</p>
        </motion.div>

        {/* Loading dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="flex justify-center gap-2 mb-6"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2.5 h-2.5 bg-white rounded-full"
              animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </motion.div>

        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="w-64 h-1.5 bg-white/20 rounded-full mx-auto overflow-hidden"
        >
          <motion.div
            className="h-full bg-white rounded-full"
            style={{ width: `${progress}%` }}
            transition={{ ease: 'linear' }}
          />
        </motion.div>
      </motion.div>
    </div>
  )
}
