import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { io } from 'socket.io-client'
import { FiBell, FiCheck, FiUser, FiVolume2, FiVolumeX, FiLogIn, FiRefreshCw } from 'react-icons/fi'

// ── Bell sound (double chime) ────────────────────────────────────────────────
function playBell(times = 2) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const play = (freq, dur, delay) => setTimeout(() => {
      try {
        const osc = ctx.createOscillator(), gain = ctx.createGain()
        osc.type = 'sine'; osc.frequency.value = freq
        gain.gain.setValueAtTime(0.9, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur)
        osc.connect(gain); gain.connect(ctx.destination)
        osc.start(); osc.stop(ctx.currentTime + dur)
      } catch (_) {}
    }, delay)
    for (let i = 0; i < times; i++) {
      play(1200, 0.35, i * 550)
      play(1500, 0.45, i * 550 + 120)
    }
  } catch (_) {}
  if ('vibrate' in navigator) navigator.vibrate([400, 150, 400, 150, 600])
}

function sendNotif(title, body) {
  if (!('Notification' in window)) return
  const send = () => { try { new Notification(title, { body, icon: '/favicon.ico', requireInteraction: true, renotify: true, tag: 'waiter-call' }) } catch (_) {} }
  if (Notification.permission === 'granted') send()
  else if (Notification.permission !== 'denied') Notification.requestPermission().then(p => p === 'granted' && send())
}

function timeAgo(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const secs = Math.floor((Date.now() - d) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

const API = '/api'

// ── Login screen ─────────────────────────────────────────────────────────────
function WaiterLogin({ onLogin }) {
  const [waiters, setWaiters]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    fetch(`${API}/users/waiters`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setWaiters(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 to-red-600 flex flex-col items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-7">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-3">🛎️</div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">Waiter Mode</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Select your name to receive calls</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-3 border-orange-400 border-t-transparent rounded-full" />
          </div>
        ) : waiters.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <p className="text-4xl mb-2">👤</p>
            <p className="text-sm">No waiters found.</p>
            <p className="text-xs mt-1">Add waiter accounts in Admin → Users.</p>
          </div>
        ) : (
          <div className="space-y-2 mb-5">
            {waiters.map(w => (
              <motion.button key={w.id} whileTap={{ scale: 0.97 }}
                onClick={() => setSelected(w)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all ${
                  selected?.id === w.id
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                }`}>
                <div className="w-11 h-11 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center text-white font-black text-lg flex-shrink-0">
                  {w.name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1 text-left">
                  <p className={`font-bold text-sm ${selected?.id === w.id ? 'text-orange-700 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
                    {w.name}
                  </p>
                  <p className="text-xs text-gray-400 capitalize">🛎️ Waiter</p>
                </div>
                {selected?.id === w.id && (
                  <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                    <FiCheck size={12} className="text-white" />
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        )}

        <motion.button whileTap={{ scale: 0.97 }}
          onClick={() => selected && onLogin(selected)}
          disabled={!selected}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-white text-base bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          <FiLogIn size={18} />
          Start Receiving Calls
        </motion.button>
      </motion.div>
    </div>
  )
}

// ── Main waiter dashboard ─────────────────────────────────────────────────────
function WaiterDashboard({ waiter, onLogout }) {
  const [calls, setCalls]       = useState([])
  const [muted, setMuted]       = useState(false)
  const [now, setNow]           = useState(Date.now())
  const [newAlert, setNewAlert] = useState(null) // popup for incoming call
  const socketRef               = useRef(null)
  const mutedRef                = useRef(muted)
  mutedRef.current              = muted

  // Tick for live elapsed time
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Resolve a call
  const resolve = useCallback(async (id) => {
    try {
      await fetch(`${API}/waiter-calls/${id}/resolve`, { method: 'PUT' })
      setCalls(prev => prev.filter(c => c.id !== id))
    } catch (_) {}
  }, [])

  // Fetch all pending calls for this waiter on mount
  const fetchMyCalls = useCallback(async () => {
    try {
      const res = await fetch(`${API}/waiter-calls`)
      if (!res.ok) return
      const all = await res.json()
      // Show calls: (a) targeted to this waiter, or (b) not targeted to anyone (broadcast)
      const mine = all.filter(c =>
        c.status === 'pending' &&
        (!c.targetWaiterId || String(c.targetWaiterId) === String(waiter.id))
      )
      setCalls(mine)
    } catch (_) {}
  }, [waiter.id])

  useEffect(() => {
    fetchMyCalls()

    // Connect socket
    const socket = io('/', { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    // Listen for calls targeted specifically to this waiter
    socket.on(`waiter_call_for_${waiter.id}`, (call) => {
      setCalls(prev => [call, ...prev.filter(c => c.id !== call.id)])
      setNewAlert(call)
      if (!mutedRef.current) {
        playBell(3)
        sendNotif(
          `🛎️ TABLE #${call.tableNumber} IS CALLING YOU!`,
          `${call.reason} — Table ${call.tableNumber}`
        )
      }
    })

    // Also listen for broadcast calls (no specific waiter targeted)
    socket.on('waiter_call_created', (call) => {
      if (call.targetWaiterId) return // skip — already handled by targeted event or another waiter
      setCalls(prev => [call, ...prev.filter(c => c.id !== call.id)])
      setNewAlert(call)
      if (!mutedRef.current) {
        playBell(2)
        sendNotif(
          `🛎️ TABLE #${call.tableNumber} NEEDS A WAITER`,
          `${call.reason} — Table ${call.tableNumber}`
        )
      }
    })

    socket.on('waiter_call_resolved', () => fetchMyCalls())
    socket.on('waiter_calls_cleared',  () => setCalls([]))

    // Poll every 10s as backup
    const poll = setInterval(fetchMyCalls, 10000)

    return () => {
      socket.disconnect()
      clearInterval(poll)
    }
  }, [waiter.id, fetchMyCalls])

  const pendingCount = calls.length

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* ── Top bar ── */}
      <div className={`flex items-center justify-between px-5 py-4 border-b ${
        pendingCount > 0
          ? 'border-red-700 bg-red-950/60'
          : 'border-gray-800 bg-gray-900'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center text-white font-black text-lg">
            {waiter.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <p className="font-black text-white text-sm">{waiter.name}</p>
            <div className="flex items-center gap-1.5">
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-green-400"
              />
              <p className="text-xs text-green-400 font-semibold">Online · Waiter Mode</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setMuted(v => !v)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${muted ? 'bg-red-900/40 text-red-400' : 'bg-gray-800 text-gray-400'}`}>
            {muted ? <FiVolumeX size={18} /> : <FiVolume2 size={18} />}
          </button>
          <button onClick={fetchMyCalls}
            className="w-9 h-9 bg-gray-800 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <FiRefreshCw size={16} />
          </button>
          <button onClick={onLogout}
            className="text-xs font-bold text-gray-500 hover:text-red-400 px-3 py-2 rounded-xl hover:bg-red-900/20 transition-colors">
            Switch
          </button>
        </div>
      </div>

      {/* ── Call counter banner ── */}
      <AnimatePresence>
        {pendingCount > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-red-600 px-5 py-3 flex items-center gap-3">
              <motion.span
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.7, repeat: Infinity }}
                className="text-2xl"
              >🛎️</motion.span>
              <p className="font-black text-white flex-1">
                {pendingCount} call{pendingCount > 1 ? 's' : ''} waiting for you!
              </p>
              {muted && <span className="text-xs bg-red-800 px-2 py-1 rounded-full font-semibold">🔇 Muted</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Calls list ── */}
      <div className="flex-1 p-4 space-y-3 overflow-auto">
        <AnimatePresence>
          {calls.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 text-center gap-4"
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center text-4xl"
              >🛎️</motion.div>
              <div>
                <p className="text-lg font-black text-gray-300">All clear!</p>
                <p className="text-sm text-gray-500 mt-1">No pending calls right now.<br />Waiting for customers...</p>
              </div>
              <div className="flex gap-1.5 mt-2">
                {[0, 1, 2].map(i => (
                  <motion.div key={i}
                    className="w-2 h-2 bg-orange-500 rounded-full"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.25 }}
                  />
                ))}
              </div>
            </motion.div>
          ) : (
            calls.map((call, idx) => {
              const secs    = Math.floor((now - new Date(call.createdAt)) / 1000)
              const mins    = Math.floor(secs / 60)
              const elapsed = mins > 0 ? `${mins}m ${secs % 60}s` : `${secs}s`
              const urgent  = secs > 60
              const isForMe = call.targetWaiterId && String(call.targetWaiterId) === String(waiter.id)

              return (
                <motion.div
                  key={call.id}
                  layout
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 60, scale: 0.9 }}
                  transition={{ type: 'spring', damping: 20 }}
                  className={`rounded-2xl border-2 p-4 ${
                    isForMe
                      ? 'border-orange-500 bg-orange-950/40'
                      : urgent
                      ? 'border-red-600 bg-red-950/30'
                      : 'border-gray-700 bg-gray-800/60'
                  }`}
                >
                  {/* Row 1: table + badges */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="bg-orange-500 text-white text-sm font-black px-3 py-1 rounded-xl">
                          TABLE #{call.tableNumber}
                        </span>
                        {isForMe && (
                          <span className="bg-orange-500/20 border border-orange-500 text-orange-400 text-xs font-bold px-2 py-0.5 rounded-full">
                            📢 Calling You
                          </span>
                        )}
                        {!call.targetWaiterId && (
                          <span className="bg-gray-700 text-gray-300 text-xs font-bold px-2 py-0.5 rounded-full">
                            📣 Broadcast
                          </span>
                        )}
                      </div>
                      {/* Reason */}
                      <p className="text-sm text-gray-200 font-semibold">"{call.reason}"</p>
                    </div>

                    {/* Elapsed timer */}
                    <span className={`text-xs font-black px-2.5 py-1 rounded-full flex-shrink-0 ml-2 ${
                      urgent
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-gray-700 text-gray-300'
                    }`}>
                      ⏱ {elapsed}
                    </span>
                  </div>

                  {/* Attend button */}
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => resolve(call.id)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-900/40 transition-all"
                  >
                    <FiCheck size={16} strokeWidth={3} />
                    I'm Attending This Table
                  </motion.button>
                </motion.div>
              )
            })
          )}
        </AnimatePresence>
      </div>

      {/* ── Incoming call popup ── */}
      <AnimatePresence>
        {newAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-[600] flex items-center justify-center p-5"
            onClick={() => setNewAlert(null)}
          >
            <motion.div
              initial={{ scale: 0.7, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 18, stiffness: 250 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-xs bg-gray-900 rounded-3xl overflow-hidden shadow-2xl border-2 border-orange-500"
            >
              {/* Pulsing red top bar */}
              <motion.div
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                className="h-2 bg-gradient-to-r from-red-500 via-orange-500 to-red-500"
              />
              <div className="p-6 text-center">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], rotate: [-10, 10, -10, 10, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.4 }}
                  className="text-6xl mb-4"
                >🛎️</motion.div>
                <p className="text-red-400 font-black text-xs uppercase tracking-widest mb-1">Incoming Call!</p>
                <h2 className="text-3xl font-black text-white mb-1">Table #{newAlert.tableNumber}</h2>
                <p className="text-sm text-gray-300 mb-1">"{newAlert.reason}"</p>
                {newAlert.targetWaiterName && (
                  <p className="text-xs text-orange-400 font-bold mb-4">📢 Calling {newAlert.targetWaiterName}</p>
                )}
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => setNewAlert(null)}
                    className="flex-1 py-3 rounded-2xl bg-gray-800 text-gray-400 font-bold text-sm hover:bg-gray-700 transition-colors"
                  >
                    Dismiss
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { resolve(newAlert.id); setNewAlert(null) }}
                    className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-black text-sm shadow-lg shadow-green-900/40 transition-all"
                  >
                    <FiCheck size={16} strokeWidth={3} /> On My Way!
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function WaiterPage() {
  const [waiter, setWaiter] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('waiter_identity')) || null } catch { return null }
  })

  const handleLogin = (w) => {
    sessionStorage.setItem('waiter_identity', JSON.stringify(w))
    setWaiter(w)
    // Request notification permission on login
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('waiter_identity')
    setWaiter(null)
  }

  return waiter
    ? <WaiterDashboard waiter={waiter} onLogout={handleLogout} />
    : <WaiterLogin onLogin={handleLogin} />
}
