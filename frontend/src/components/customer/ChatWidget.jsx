import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { io } from 'socket.io-client'
import useCartStore from '../../store/useCartStore'
import { useOrderStore } from '../../store/useOrderStore'
import { useTranslation } from 'react-i18next'

const API = () => '/api'

// Generate stable session ID per browser tab
function getSessionId() {
  let id = sessionStorage.getItem('chat_session')
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    sessionStorage.setItem('chat_session', id)
  }
  return id
}

// Render markdown-lite: **bold**, bullet points, line breaks
function RenderText({ text }) {
  const lines = text.split('\n')
  return (
    <span>
      {lines.map((line, i) => {
        const parts = line.split(/\*\*(.*?)\*\*/g)
        return (
          <span key={i}>
            {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
            {i < lines.length - 1 && <br />}
          </span>
        )
      })}
    </span>
  )
}

// Quick reply chips shown after bot messages
const QUICK_REPLIES = [
  { label: '🍽️ Show Menu',      text: 'Show me the menu' },
  { label: '💰 Prices',         text: 'What are the prices?' },
  { label: '🕐 Hours',          text: 'What are your opening hours?' },
  { label: '📍 Location',       text: 'Where are you located?' },
  { label: '📦 Track Order',    text: 'I want to track my order' },
  { label: '🛎️ Call Waiter',    text: 'I need a waiter' },
  { label: '💳 Pay the Bill',   text: 'I want to pay the bill' },
  { label: '📶 WiFi Password',  text: 'What is the WiFi password?' },
]

export default function ChatWidget() {
  const { i18n } = useTranslation()
  const tableNumber = useCartStore(s => s.tableNumber)
  const orders      = useOrderStore(s => s.orders)

  // Pull customer name from the most recent order that has one
  const customerName = orders?.find(o => o.customerName || o.customer_name)
    ?.customerName || orders?.find(o => o.customerName || o.customer_name)
    ?.customer_name || ''

  // Also try from sessionStorage if previously saved
  const [displayName, setDisplayName] = useState(() =>
    sessionStorage.getItem('chat_customer_name') || customerName || ''
  )
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [nameInput, setNameInput]           = useState('')

  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput]       = useState('')
  const [typing, setTyping]     = useState(false)
  const [unread, setUnread]     = useState(0)
  const [sessionId]             = useState(getSessionId)
  const [showQuick, setShowQuick] = useState(true)
  const bottomRef               = useRef(null)
  const inputRef                = useRef(null)
  const socketRef               = useRef(null)

  // Add initial greeting on mount — personalised if name known
  useEffect(() => {
    const name = sessionStorage.getItem('chat_customer_name') || customerName
    const greeting = name
      ? `👋 Hi **${name}**! Welcome to **MEGA Digital Menu**.\n\nHow can I help you today?`
      : `👋 Hi! Welcome to **MEGA Digital Menu**! I'm your virtual assistant.\n\nHow can I help you today?`

    setMessages([{
      role: 'bot',
      text: greeting,
      ts: new Date().toISOString(),
      id: 'init',
    }])

    // Connect socket for admin replies
    const socket = io('/', { transports: ['websocket', 'polling'] })
    socketRef.current = socket
    socket.on(`chat_admin_reply_${sessionId}`, (msg) => {
      setMessages(prev => [...prev, msg])
      if (!open) setUnread(u => u + 1)
    })
    return () => socket.disconnect()
  }, [sessionId])

  // Scroll to bottom
  useEffect(() => {
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
  }, [messages, open, typing])

  // Focus input when opened, show name prompt if no name
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200)
      setUnread(0)
      // Show name prompt once if we don't know who the customer is
      const saved = sessionStorage.getItem('chat_customer_name') || customerName
      if (!saved && !showNamePrompt) {
        setShowNamePrompt(true)
      }
    }
  }, [open])

  const sendMessage = useCallback(async (text) => {
    const msg = text || input.trim()
    if (!msg) return
    setInput('')
    setShowQuick(false)

    // If no name yet and this is the first real message, check if message IS their name
    const currentName = sessionStorage.getItem('chat_customer_name') || customerName

    const userMsg = { role: 'customer', text: msg, ts: new Date().toISOString(), id: `${Date.now()}-u` }
    setMessages(prev => [...prev, userMsg])
    setTyping(true)

    try {
      const res = await fetch(`${API()}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          tableNumber,
          customerName: currentName,
          message: msg,
        }),
      })
      const data = await res.json()
      setTyping(false)
      if (data.message) {
        setMessages(prev => [...prev, data.message])
        setShowQuick(true)
      }
    } catch {
      setTyping(false)
      setMessages(prev => [...prev, {
        role: 'bot',
        text: '😔 Sorry, I\'m having trouble connecting right now. Please try again or call us directly!',
        ts: new Date().toISOString(),
        id: `${Date.now()}-err`,
      }])
    }
  }, [input, sessionId, tableNumber, customerName])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <>
      {/* ── Floating Chat Button ── */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1.5, type: 'spring', damping: 12 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-[200] w-14 h-14 bg-gradient-to-br from-orange-500 to-red-500 rounded-full shadow-2xl shadow-orange-400/50 flex items-center justify-center text-white"
        style={{ display: open ? 'none' : 'flex' }}
      >
        <motion.span
          animate={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}
          className="text-2xl"
        >💬</motion.span>
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg"
          >
            {unread > 9 ? '9+' : unread}
          </motion.span>
        )}
        {/* Pulse ring */}
        <motion.div
          animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 bg-orange-400 rounded-full -z-10"
        />
      </motion.button>

      {/* ── Chat Drawer ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.9 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            className="fixed bottom-4 right-4 z-[300] w-[92vw] max-w-sm flex flex-col bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden"
            style={{ height: '75vh', maxHeight: 580 }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 px-5 py-4 flex items-center gap-3 flex-shrink-0">
              <div className="relative">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-2xl">🍽️</div>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-white text-sm">MEGA Digital Menu</p>
                <div className="flex items-center gap-1 flex-wrap">
                  <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0" />
                  <p className="text-orange-100 text-xs truncate">
                    {displayName
                      ? `Hi ${displayName}${tableNumber ? ` · Table ${tableNumber}` : ''}`
                      : tableNumber ? `Table ${tableNumber} · Online` : 'Online · Typically replies instantly'}
                  </p>
                </div>
              </div>
              {displayName && (
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <button onClick={() => setOpen(false)}
                className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors text-lg flex-shrink-0">
                ×
              </button>
            </div>

            {/* Name prompt — only shown once if no name available */}
            <AnimatePresence>
              {showNamePrompt && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-orange-50 dark:bg-orange-900/20 border-b border-orange-100 dark:border-orange-800 px-4 py-3">
                    <p className="text-xs font-bold text-orange-700 dark:text-orange-400 mb-2">
                      👤 What's your name? (optional)
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            const n = nameInput.trim()
                            if (n) {
                              setDisplayName(n)
                              sessionStorage.setItem('chat_customer_name', n)
                              setMessages(prev => [{
                                ...prev[0],
                                text: `👋 Hi **${n}**! Welcome to **MEGA Digital Menu**.\n\nHow can I help you today?`,
                              }, ...prev.slice(1)])
                            }
                            setShowNamePrompt(false)
                          }
                        }}
                        placeholder="Enter your name..."
                        className="flex-1 text-sm px-3 py-1.5 bg-white dark:bg-gray-800 border border-orange-200 dark:border-orange-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          const n = nameInput.trim()
                          if (n) {
                            setDisplayName(n)
                            sessionStorage.setItem('chat_customer_name', n)
                            setMessages(prev => [{
                              ...prev[0],
                              text: `👋 Hi **${n}**! Welcome to **ABC Restaurant**.\n\nHow can I help you today?`,
                            }, ...prev.slice(1)])
                          }
                          setShowNamePrompt(false)
                        }}
                        className="px-3 py-1.5 bg-orange-500 text-white text-xs font-bold rounded-xl hover:bg-orange-600 transition-colors"
                      >
                        {nameInput.trim() ? 'Save' : 'Skip'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50 dark:bg-gray-950">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2 ${msg.role === 'customer' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar */}
                  {msg.role !== 'customer' && (
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-1 shadow ${
                      msg.role === 'admin'
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white'
                        : 'bg-gradient-to-br from-orange-400 to-red-500 text-white'
                    }`}>
                      {msg.role === 'admin' ? '👨‍💼' : '🤖'}
                    </div>
                  )}

                  {/* Bubble */}
                  <div className={`max-w-[80%] ${msg.role === 'customer' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    {msg.role === 'admin' && msg.adminName && (
                      <p className="text-[10px] text-blue-500 font-bold ml-1">{msg.adminName} · Staff</p>
                    )}
                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      msg.role === 'customer'
                        ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-tr-sm'
                        : msg.role === 'admin'
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white rounded-tl-sm'
                        : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm border border-gray-100 dark:border-gray-700'
                    }`}>
                      <RenderText text={msg.text} />
                    </div>
                    <p className={`text-[10px] text-gray-400 px-1 ${msg.role === 'customer' ? 'text-right' : 'text-left'}`}>
                      {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              <AnimatePresence>
                {typing && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-sm shadow">🤖</div>
                    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5">
                      {[0,1,2].map(i => (
                        <motion.div key={i} className="w-2 h-2 bg-orange-400 rounded-full"
                          animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={bottomRef} />
            </div>

            {/* Quick replies */}
            <AnimatePresence>
              {showQuick && !typing && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
                  <div className="flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-hide">
                    {QUICK_REPLIES.map((q, i) => (
                      <motion.button key={i} whileTap={{ scale: 0.93 }}
                        onClick={() => sendMessage(q.text)}
                        className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 rounded-full hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors whitespace-nowrap">
                        {q.label}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input */}
            <div className="px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex items-end gap-3 flex-shrink-0">
              <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2.5 flex items-end gap-2 min-h-[44px]">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Type a message..."
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 resize-none outline-none max-h-24 leading-relaxed"
                  style={{ scrollbarWidth: 'none' }}
                />
              </div>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => sendMessage()}
                disabled={!input.trim() && !typing}
                className={`w-11 h-11 rounded-full flex items-center justify-center text-white shadow-lg flex-shrink-0 transition-all ${
                  input.trim()
                    ? 'bg-gradient-to-br from-orange-500 to-red-500 shadow-orange-300'
                    : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
