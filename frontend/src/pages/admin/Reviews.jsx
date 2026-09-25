import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiRefreshCw, FiStar, FiMessageSquare, FiTrash2, FiX } from 'react-icons/fi'
import client from '../../api/client'

function StarDisplay({ value, size = 16 }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} style={{ fontSize: size }} className="leading-none">
          {n <= value ? '⭐' : '☆'}
        </span>
      ))}
    </span>
  )
}

function RatingBar({ label, value, total }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-16 text-gray-500 dark:text-gray-400 text-xs font-medium shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full bg-orange-400 rounded-full"
        />
      </div>
      <span className="w-8 text-right text-xs font-bold text-gray-600 dark:text-gray-400">{value}</span>
    </div>
  )
}

function timeAgo(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString()
}

const RATING_FILTER_OPTIONS = [
  { label: 'All', value: 0 },
  { label: '⭐⭐⭐⭐⭐', value: 5 },
  { label: '⭐⭐⭐⭐', value: 4 },
  { label: '⭐⭐⭐', value: 3 },
  { label: '⭐⭐', value: 2 },
  { label: '⭐', value: 1 },
]

export default function Reviews() {
  const [reviews, setReviews]     = useState([])
  const [summary, setSummary]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState(0)
  const [selected, setSelected]   = useState(null)
  const [deleting, setDeleting]   = useState(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchAll = useCallback(async () => {
    try {
      const [revRes, sumRes] = await Promise.all([
        client.get('/reviews'),
        client.get('/reviews/summary'),
      ])
      setReviews(revRes.data)
      setSummary(sumRes.data)
      setLastRefresh(new Date())
    } catch (_) {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this review?')) return
    setDeleting(id)
    try {
      await client.delete(`/reviews/${id}`)
      setReviews(prev => prev.filter(r => r.id !== id))
      if (selected?.id === id) setSelected(null)
    } catch (_) {}
    finally { setDeleting(null) }
  }

  const filtered = filter === 0
    ? reviews
    : reviews.filter(r => r.overall_rating === filter)

  const avgOverall = summary?.avg_overall ? Number(summary.avg_overall).toFixed(1) : '—'
  const avgFood    = summary?.avg_food    ? Number(summary.avg_food).toFixed(1)    : '—'
  const avgService = summary?.avg_service ? Number(summary.avg_service).toFixed(1) : '—'
  const total      = summary?.total ?? reviews.length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            ⭐ Customer Reviews
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {total} review{total !== 1 ? 's' : ''} · refreshed {timeAgo(lastRefresh)}
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-colors shadow-md shadow-orange-200 dark:shadow-none"
        >
          <FiRefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Overall Rating',   value: avgOverall, icon: '⭐', color: 'bg-orange-500' },
          { label: 'Food Quality',     value: avgFood,    icon: '🍽️', color: 'bg-green-500' },
          { label: 'Service',          value: avgService, icon: '👨‍🍳', color: 'bg-blue-500' },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4"
          >
            <div className={`w-12 h-12 ${s.color} rounded-xl flex items-center justify-center text-2xl shadow-md`}>
              {s.icon}
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{s.value}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: breakdown + filter */}
        <div className="space-y-4">
          {/* Star breakdown */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Rating Breakdown</h3>
            <div className="space-y-2">
              <RatingBar label="5 stars" value={summary?.five_star  ?? 0} total={total} />
              <RatingBar label="4 stars" value={summary?.four_star  ?? 0} total={total} />
              <RatingBar label="3 stars" value={summary?.three_star ?? 0} total={total} />
              <RatingBar label="2 stars" value={summary?.two_star   ?? 0} total={total} />
              <RatingBar label="1 star"  value={summary?.one_star   ?? 0} total={total} />
            </div>
          </div>

          {/* Filter */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">Filter</h3>
            <div className="space-y-1">
              {RATING_FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    filter === opt.value
                      ? 'bg-orange-500 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {opt.label}
                  <span className="float-right text-xs opacity-70">
                    {opt.value === 0 ? total : (reviews.filter(r => r.overall_rating === opt.value).length)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: review list */}
        <div className="xl:col-span-2 space-y-3">
          {loading ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-12 border border-gray-100 dark:border-gray-800 text-center text-gray-400">
              Loading reviews...
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-12 border border-gray-100 dark:border-gray-800 text-center">
              <p className="text-4xl mb-3">💬</p>
              <p className="font-bold text-gray-600 dark:text-gray-400">No reviews yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Reviews will appear here after customers rate their experience
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {filtered.map((r, idx) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: idx * 0.04 }}
                  className={`bg-white dark:bg-gray-900 rounded-2xl border shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                    selected?.id === r.id
                      ? 'border-orange-400 dark:border-orange-600'
                      : 'border-gray-100 dark:border-gray-800'
                  }`}
                  onClick={() => setSelected(selected?.id === r.id ? null : r)}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      {/* Avatar + info */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                          {r.customer_name ? r.customer_name.charAt(0).toUpperCase() : '👤'}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-sm">
                            {r.customer_name || 'Anonymous'}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {r.table_number ? `🪑 Table ${r.table_number}` : ''} · {timeAgo(r.created_at)}
                          </p>
                        </div>
                      </div>
                      {/* Stars + delete */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StarDisplay value={r.overall_rating} size={14} />
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(r.id) }}
                          disabled={deleting === r.id}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
                        >
                          <FiTrash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Comment preview */}
                    {r.comment && (
                      <p className={`mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed ${
                        selected?.id === r.id ? '' : 'line-clamp-2'
                      }`}>
                        <FiMessageSquare size={12} className="inline mr-1 opacity-50" />
                        "{r.comment}"
                      </p>
                    )}

                    {/* Sub-ratings expanded */}
                    <AnimatePresence>
                      {selected?.id === r.id && (r.food_rating || r.service_rating) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-3">
                            {r.food_rating && (
                              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3">
                                <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold mb-1">🍽️ Food</p>
                                <StarDisplay value={r.food_rating} size={13} />
                              </div>
                            )}
                            {r.service_rating && (
                              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                                <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1">👨‍🍳 Service</p>
                                <StarDisplay value={r.service_rating} size={13} />
                              </div>
                            )}
                          </div>
                          {r.order_ref && (
                            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                              📋 Order: {r.order_ref}
                              {r.phone && ` · 📞 ${r.phone}`}
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  )
}
