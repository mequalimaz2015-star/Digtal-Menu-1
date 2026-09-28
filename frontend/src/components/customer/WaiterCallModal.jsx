import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiBell, FiCheck } from 'react-icons/fi'

// Works on both localhost and production (same-origin /api)
const getApiBase = () => '/api'

const PRESET_REASONS = [
  { icon: '🍽️', en: 'Ready to order',      am: 'ትዕዛዝ ለመስጠት ዝግጁ ነኝ' },
  { icon: '🧾', en: 'Request the bill',     am: 'ሂሳብ እፈልጋለሁ' },
  { icon: '🥤', en: 'Need drinks refill',   am: 'መጠጥ ሙሌት እፈልጋለሁ' },
  { icon: '🧂', en: 'Need condiments',      am: 'ቅመማ ቅመም እፈልጋለሁ' },
  { icon: '🧹', en: 'Table needs cleaning', am: 'ጠረጴዛ ማጽዳት ያስፈልጋል' },
  { icon: '❓', en: 'Have a question',      am: 'ጥያቄ አለኝ' },
  { icon: '🚨', en: 'Urgent assistance',    am: 'አስቸኳይ እርዳታ እፈልጋለሁ' },
]

export default function WaiterCallModal({ open, onClose, tableNumber, language = 'en' }) {
  const lang = language === 'am' ? 'am' : 'en'

  const [step, setStep]               = useState(1) // 1=reason, 2=waiter, 3=done
  const [selectedReason, setReason]   = useState(null)
  const [customReason, setCustom]     = useState('')
  const [waiters, setWaiters]         = useState([])
  const [loadingWaiters, setLoading]  = useState(false)
  const [selectedWaiter, setWaiter]   = useState(null) // null = any waiter
  const [submitting, setSubmitting]   = useState(false)

  // Fetch available waiters when step 2 opens
  useEffect(() => {
    if (step === 2) {
      setLoading(true)
      fetch(`${getApiBase()}/users/waiters`)
        .then(r => r.ok ? r.json() : [])
        .then(data => { setWaiters(data); setLoading(false) })
        .catch(() => { setWaiters([]); setLoading(false) })
    }
  }, [step])

  const reset = () => {
    setStep(1); setReason(null); setCustom(''); setWaiter(null); setSubmitting(false)
  }

  const handleClose = () => { reset(); onClose() }

  const finalReason = selectedReason
    ? (lang === 'am' ? selectedReason.am : selectedReason.en)
    : customReason.trim() || (lang === 'am' ? 'እርዳታ ያስፈልጋል' : 'Assistance requested')

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await fetch('/api/waiter-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber:      tableNumber || '1',
          reason:           finalReason,
          targetWaiterId:   selectedWaiter?.id   || null,
          targetWaiterName: selectedWaiter?.name || null,
        }),
      })
      setStep(3)
    } catch {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[400] flex items-end justify-center"
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl pb-8"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-xl">🛎️</div>
                <div>
                  <h2 className="font-black text-gray-900 dark:text-white text-base">
                    {lang === 'am' ? 'አስተናጋጅ ጥሪ' : 'Call a Waiter'}
                  </h2>
                  {tableNumber && (
                    <p className="text-xs text-orange-500 font-semibold">🪑 Table {tableNumber}</p>
                  )}
                </div>
              </div>
              <button onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                <FiX size={16} />
              </button>
            </div>

            {/* ── STEP 1: Reason ── */}
            {step === 1 && (
              <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                className="px-6 pt-5 pb-2 space-y-4">
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  {lang === 'am' ? '1. ለምን ትጠራለህ?' : '1. Why are you calling?'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_REASONS.map((r, i) => (
                    <motion.button key={i} type="button" whileTap={{ scale: 0.96 }}
                      onClick={() => { setReason(r); setCustom('') }}
                      className={`flex items-center gap-2.5 px-3 py-3 rounded-2xl border-2 text-left transition-all ${
                        selectedReason === r
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-orange-300'
                      }`}>
                      <span className="text-xl flex-shrink-0">{r.icon}</span>
                      <span className={`text-xs font-semibold leading-tight ${
                        selectedReason === r ? 'text-orange-700 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {lang === 'am' ? r.am : r.en}
                      </span>
                      {selectedReason === r && (
                        <FiCheck size={14} className="text-orange-500 ml-auto flex-shrink-0" />
                      )}
                    </motion.button>
                  ))}
                </div>
                {/* Custom reason */}
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                    {lang === 'am' ? 'ወይም ምክንያት ይፃፉ:' : 'Or write your own reason:'}
                  </p>
                  <input
                    type="text"
                    value={customReason}
                    onChange={e => { setCustom(e.target.value); setReason(null) }}
                    placeholder={lang === 'am' ? 'ምክንያት ይፃፉ...' : 'Type your reason...'}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-orange-400 transition-colors"
                  />
                </div>
                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={() => setStep(2)}
                  disabled={!selectedReason && !customReason.trim()}
                  className="w-full py-4 rounded-2xl font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-200 dark:shadow-none transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                  {lang === 'am' ? 'ቀጥል →' : 'Continue →'}
                </motion.button>
              </motion.div>
            )}

            {/* ── STEP 2: Pick waiter ── */}
            {step === 2 && (
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                className="px-6 pt-5 pb-2 space-y-4">
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  {lang === 'am' ? '2. አስተናጋጅ ይምረጡ:' : '2. Choose a waiter (optional):'}
                </p>

                {/* Selected reason recap */}
                <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 rounded-xl px-3 py-2">
                  <span className="text-lg">{selectedReason?.icon || '📝'}</span>
                  <p className="text-sm font-semibold text-orange-700 dark:text-orange-400 line-clamp-1">{finalReason}</p>
                </div>

                {loadingWaiters ? (
                  <div className="flex items-center justify-center py-8 gap-3 text-gray-400">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full" />
                    <span className="text-sm">{lang === 'am' ? 'አስተናጋጆች እየተጫኑ...' : 'Loading waiters...'}</span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {/* Any waiter option */}
                    <motion.button type="button" whileTap={{ scale: 0.97 }}
                      onClick={() => setWaiter(null)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all ${
                        selectedWaiter === null
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-orange-300'
                      }`}>
                      <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                        🛎️
                      </div>
                      <div className="flex-1 text-left">
                        <p className={`font-bold text-sm ${selectedWaiter === null ? 'text-orange-700 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
                          {lang === 'am' ? 'ማንኛውም አስተናጋጅ' : 'Any available waiter'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {lang === 'am' ? 'ሁሉም አስተናጋጆች ማሳወቂያ ያገኛሉ' : 'All waiters will be notified'}
                        </p>
                      </div>
                      {selectedWaiter === null && <FiCheck size={16} className="text-orange-500 flex-shrink-0" />}
                    </motion.button>

                    {/* Individual waiters */}
                    {waiters.map(w => (
                      <motion.button key={w.id} type="button" whileTap={{ scale: 0.97 }}
                        onClick={() => setWaiter(w)}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all ${
                          selectedWaiter?.id === w.id
                            ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-orange-300'
                        }`}>
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center text-white font-black text-base flex-shrink-0">
                          {w.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 text-left">
                          <p className={`font-bold text-sm ${selectedWaiter?.id === w.id ? 'text-orange-700 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
                            {w.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">🛎️ Waiter</p>
                        </div>
                        {selectedWaiter?.id === w.id && <FiCheck size={16} className="text-orange-500 flex-shrink-0" />}
                      </motion.button>
                    ))}

                    {waiters.length === 0 && (
                      <p className="text-center text-xs text-gray-400 py-2">
                        {lang === 'am' ? 'አስተናጋጆች አልተገኙም' : 'No waiters found — any waiter will respond'}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button onClick={() => setStep(1)}
                    className="flex-1 py-3.5 rounded-2xl font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    ← {lang === 'am' ? 'ተመለስ' : 'Back'}
                  </button>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={handleSubmit}
                    disabled={submitting || loadingWaiters}
                    className="flex-[2] flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-200 dark:shadow-none transition-all disabled:opacity-60">
                    {submitting ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                        className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full" />
                    ) : (
                      <><FiBell size={16} /> {lang === 'am' ? '🛎️ ጥሪ ላክ' : '🛎️ Call Waiter'}</>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: Done ── */}
            {step === 3 && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="px-6 py-8 flex flex-col items-center text-center gap-4">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                  className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <span className="text-4xl">🛎️</span>
                </motion.div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white mb-1">
                    {lang === 'am' ? 'ጥሪ ተልኳል!' : 'Waiter Called!'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    {selectedWaiter
                      ? (lang === 'am'
                          ? `${selectedWaiter.name} ብዙ ሳይቆይ ይመጣሉ።`
                          : `${selectedWaiter.name} will be with you shortly.`)
                      : (lang === 'am'
                          ? 'አስተናጋጅ ብዙ ሳይቆይ ይመጣል።'
                          : 'A waiter will be with you shortly.')}
                  </p>
                  <div className="mt-3 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-2 inline-block">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      <span className="font-semibold">{lang === 'am' ? 'ምክንያት: ' : 'Reason: '}</span>
                      {finalReason}
                    </p>
                    {selectedWaiter && (
                      <p className="text-xs text-orange-500 font-semibold mt-0.5">
                        → {selectedWaiter.name}
                      </p>
                    )}
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleClose}
                  className="w-full py-4 rounded-2xl font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-200 dark:shadow-none transition-all">
                  {lang === 'am' ? 'ዝጋ' : 'Close'}
                </motion.button>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
