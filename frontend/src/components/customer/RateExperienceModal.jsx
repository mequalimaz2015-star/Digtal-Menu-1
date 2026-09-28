import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiSend } from 'react-icons/fi'
import client from '../../api/client'
import toast from 'react-hot-toast'

const CATEGORIES = [
  { key: 'food',    label: 'Food Quality',    labelAm: 'የምግብ ጥራት',    emoji: '🍽️' },
  { key: 'service', label: 'Service',          labelAm: 'አገልግሎት',       emoji: '👨‍🍳' },
]

const STAR_LABELS = {
  1: { en: 'Poor',      am: 'መጥፎ' },
  2: { en: 'Fair',      am: 'ጥሩ አይደለም' },
  3: { en: 'Good',      am: 'ጥሩ' },
  4: { en: 'Very Good', am: 'በጣም ጥሩ' },
  5: { en: 'Excellent', am: 'እጅግ ጥሩ' },
}

function StarRow({ value, onChange, size = 36 }) {
  const [hovered, setHovered] = useState(0)
  const active = hovered || value
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map(n => (
        <motion.button
          key={n}
          type="button"
          whileTap={{ scale: 0.8 }}
          whileHover={{ scale: 1.15 }}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          style={{ fontSize: size }}
          className="leading-none transition-all duration-150"
        >
          {n <= active ? '⭐' : '☆'}
        </motion.button>
      ))}
    </div>
  )
}

export default function RateExperienceModal({ open, onClose, orderRef, tableNumber, customerName, phone, language = 'en' }) {
  const [overall, setOverall]   = useState(0)
  const [food,    setFood]      = useState(0)
  const [service, setService]   = useState(0)
  const [comment, setComment]   = useState('')
  const [step,    setStep]      = useState(1)   // 1 = rate, 2 = comment, 3 = done
  const [loading, setLoading]   = useState(false)

  const lang = language === 'am' ? 'am' : 'en'

  const reset = () => {
    setOverall(0); setFood(0); setService(0)
    setComment(''); setStep(1); setLoading(false)
  }

  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async () => {
    if (!overall) { toast.error('Please select an overall rating'); return }
    setLoading(true)
    try {
      await client.post('/reviews', {
        orderRef,
        tableNumber,
        customerName,
        phone,
        overallRating:  overall,
        foodRating:     food    || null,
        serviceRating:  service || null,
        comment:        comment.trim(),
      })
      setStep(3)
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not submit review. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-end justify-center"
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl pb-10"
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white">
                  {lang === 'am' ? 'ልምድዎን ይገምግሙ' : 'Rate Your Experience'}
                </h2>
                {tableNumber && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">🪑 Table {tableNumber}</p>
                )}
              </div>
              <button
                onClick={handleClose}
                className="w-9 h-9 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center"
              >
                <FiX size={18} className="text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            {/* ── Step 1: Star ratings ── */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                className="px-6 pt-5 pb-4 space-y-6"
              >
                {/* Overall */}
                <div className="flex flex-col items-center text-center">
                  <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">
                    {lang === 'am' ? 'አጠቃላይ ደረጃ' : 'Overall Rating'}
                  </p>
                  <StarRow value={overall} onChange={setOverall} size={44} />
                  <AnimatePresence mode="wait">
                    {overall > 0 && (
                      <motion.p
                        key={overall}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-2 text-base font-bold text-orange-500"
                      >
                        {STAR_LABELS[overall][lang]}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Sub-ratings */}
                <div className="grid grid-cols-2 gap-3">
                  {CATEGORIES.map(cat => (
                    <div
                      key={cat.key}
                      className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3 flex flex-col items-center gap-2"
                    >
                      <span className="text-2xl">{cat.emoji}</span>
                      <p className="text-xs font-bold text-gray-600 dark:text-gray-300 text-center">
                        {lang === 'am' ? cat.labelAm : cat.label}
                      </p>
                      <StarRow
                        value={cat.key === 'food' ? food : service}
                        onChange={cat.key === 'food' ? setFood : setService}
                        size={22}
                      />
                    </div>
                  ))}
                </div>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => overall > 0 && setStep(2)}
                  className={`w-full py-4 rounded-2xl font-bold text-white text-base transition-all ${
                    overall > 0
                      ? 'bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-200 dark:shadow-none'
                      : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                  }`}
                >
                  {lang === 'am' ? 'ቀጥል →' : 'Continue →'}
                </motion.button>
              </motion.div>
            )}

            {/* ── Step 2: Comment ── */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                className="px-6 pt-5 pb-4 space-y-4"
              >
                {/* Rating recap */}
                <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-900/20 rounded-2xl px-4 py-3">
                  <div>
                    <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold">
                      {lang === 'am' ? 'አጠቃላይ ደረጃዎ' : 'Your overall rating'}
                    </p>
                    <p className="text-2xl font-black text-orange-500">
                      {'⭐'.repeat(overall)}{'☆'.repeat(5 - overall)}
                    </p>
                  </div>
                  <span className="text-3xl">
                    {overall >= 4 ? '😊' : overall === 3 ? '😐' : '😞'}
                  </span>
                </div>

                {/* Comment box */}
                <div>
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300 block mb-2">
                    {lang === 'am' ? 'አስተያየትዎን ያጋሩ (አስፈላጊ አይደለም)' : 'Share your thoughts (optional)'}
                  </label>
                  <textarea
                    rows={4}
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    maxLength={500}
                    placeholder={
                      lang === 'am'
                        ? 'ስለ ምግቡ፣ አገልግሎቱ፣ ወይም ሌላ ነገር ይናገሩ...'
                        : 'Tell us about the food, service, ambiance...'
                    }
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  <p className="text-right text-xs text-gray-400 mt-1">{comment.length}/500</p>
                </div>

                {/* Quick phrases */}
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {lang === 'am' ? 'ፈጣን ምርጫዎች:' : 'Quick picks:'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Great food! 🍽️',
                      'Fast service ⚡',
                      'Will come back 🔄',
                      'Loved the ambiance ✨',
                      'Friendly staff 😊',
                    ].map(phrase => (
                      <button
                        key={phrase}
                        type="button"
                        onClick={() => setComment(prev => prev ? `${prev} ${phrase}` : phrase)}
                        className="text-xs bg-gray-100 dark:bg-gray-800 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-full transition-colors border border-gray-200 dark:border-gray-700"
                      >
                        {phrase}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 py-4 rounded-2xl font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    ← {lang === 'am' ? 'ተመለስ' : 'Back'}
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-2 flex-grow py-4 rounded-2xl font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-200 dark:shadow-none flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                  >
                    {loading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                      />
                    ) : (
                      <>
                        <FiSend size={16} />
                        {lang === 'am' ? 'አስገባ' : 'Submit'}
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Thank you ── */}
            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-6 py-10 flex flex-col items-center text-center gap-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                  className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center"
                >
                  <span className="text-5xl">🎉</span>
                </motion.div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white">
                  {lang === 'am' ? 'እናመሰግናለን!' : 'Thank You!'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed max-w-xs">
                  {lang === 'am'
                    ? 'አስተያየትዎ ምግብ ቤቱን ለማሻሻል ይረዳናል። እንደገና እንዲጠቡን ተስፋ እናደርጋለን!'
                    : 'Your feedback helps us improve. We hope to see you again soon!'}
                </p>
                <div className="text-3xl mt-1">{'⭐'.repeat(overall)}</div>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleClose}
                  className="mt-2 w-full py-4 rounded-2xl font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-200 dark:shadow-none transition-colors"
                >
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
