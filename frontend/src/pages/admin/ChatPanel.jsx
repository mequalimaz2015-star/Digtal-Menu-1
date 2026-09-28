import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { io } from 'socket.io-client'
import { FiSend, FiRefreshCw, FiTrash2, FiMessageSquare, FiUser } from 'react-icons/fi'

const getApiBase = () => '/api'
const getToken  = () => localStorage.getItem('token')

function timeAgo(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const s = Math.floor((Date.now() - d) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return d.toLocaleDateString()
}

// Render markdown-lite **bold**
function RenderText({ text }) {
  return (
    <span>
      {text.split('\n').map((line, i, arr) => {
        const parts = line.split(/\*\*(.*?)\*\*/g)
        return (
          <span key={i}>
            {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
            {i < arr.length - 1 && <br />}
          </span>
        )
      })}
    </span>
  )
}

export default function ChatPanel() {
  const [sessions, setSessions]       = useState([])
  const [activeId, setActiveId]       = useState(null)
  const [messages, setMessages]       = useState([])
  const [reply, setReply]             = useState('')
  const [loadingSessions, setLoadSess]= useState(true)
  const [sending, setSending]         = useState(false)
  const [newMsgFlash, setFlash]       = useState({})   // { sessionId: count }
  const bottomRef                     = useRef(null)
  const socketRef                     = useRef(null)
  const textareaRef                   = useRef(null)

  // ── Load sessions ────────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/chat/sessions`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setSessions(await res.json())
    } catch (_) {}
    finally { setLoadSess(false) }
  }, [])

  // ── Load messages for active session ────────────────────────────────────────
  const loadMessages = useCallback(async (sessionId) => {
    try {
      const res = await fetch(`${getApiBase()}/chat/${sessionId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
        // Clear unread badge
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, unread: 0 } : s))
      }
    } catch (_) {}
  }, [])

  useEffect(() => {
    loadSessions()

    // Socket: listen for new customer messages from any session
    const socket = io('/', { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('chat_new_message', (data) => {
      // Update session list with unread badge and customer name
      setSessions(prev => {
        const exists = prev.find(s => s.id === data.sessionId)
        if (exists) {
          return prev.map(s => s.id === data.sessionId
            ? {
                ...s,
                unread: (s.unread || 0) + 1,
                lastActivity: data.message.ts,
                // Update name if we just got it for the first time
                customerName: data.customerName || s.customerName,
                tableNumber:  data.tableNumber  || s.tableNumber,
              }
            : s
          )
        }
        // New session — reload the full list
        loadSessions()
        return prev
      })

      setFlash(prev => ({ ...prev, [data.sessionId]: (prev[data.sessionId] || 0) + 1 }))

      // If we're viewing this session, append the message
      setActiveId(curr => {
        if (curr === data.sessionId) {
          setMessages(prev => {
            // avoid duplicates
            if (prev.find(m => m.id === data.message.id)) return prev
            return [...prev, data.message]
          })
        }
        return curr
      })
    })

    // Poll every 15s as fallback
    const poll = setInterval(loadSessions, 15000)
    return () => { socket.disconnect(); clearInterval(poll) }
  }, [loadSessions])

  useEffect(() => {
    if (activeId) loadMessages(activeId)
  }, [activeId, loadMessages])

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
  }, [messages])

  const handleSelectSession = (id) => {
    setActiveId(id)
    setFlash(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  const handleSend = async () => {
    if (!reply.trim() || !activeId || sending) return
    setSending(true)
    try {
      const res = await fetch(`${getApiBase()}/chat/${activeId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ message: reply.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, data.message])
        setReply('')
        textareaRef.current?.focus()
      }
    } catch (_) {}
    finally { setSending(false) }
  }

  const handleDelete = async (sessionId) => {
    if (!confirm('Clear this conversation?')) return
    try {
      await fetch(`${getApiBase()}/chat/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      if (activeId === sessionId) { setActiveId(null); setMessages([]) }
    } catch (_) {}
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const activeSession = sessions.find(s => s.id === activeId)
  const totalUnread   = sessions.reduce((sum, s) => sum + (s.unread || 0), 0)

  return (
    <div className="h-[calc(100vh-8rem)] flex rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">

      {/* ── LEFT: Session list ── */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-gray-100 dark:border-gray-800">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="font-black text-gray-900 dark:text-white text-base flex items-center gap-2">
              💬 Chat Support
              {totalUnread > 0 && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </motion.span>
              )}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sessions.length} conversation{sessions.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={loadSessions}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <FiRefreshCw size={14} />
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto">
          {loadingSessions ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="text-5xl mb-3">💬</div>
              <p className="font-bold text-gray-600 dark:text-gray-400 text-sm">No conversations yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Customer messages will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {sessions.map(session => {
                const lastMsg  = session.messages?.[session.messages.length - 1]
                const isActive = session.id === activeId
                const hasNew   = newMsgFlash[session.id] || session.unread > 0
                return (
                  <motion.button
                    key={session.id}
                    layout
                    onClick={() => handleSelectSession(session.id)}
                    className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-all hover:bg-gray-50 dark:hover:bg-gray-800 relative ${
                      isActive ? 'bg-orange-50 dark:bg-orange-900/20 border-r-2 border-orange-500' : ''
                    }`}
                  >
                    {/* Avatar with name initial */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 shadow-sm text-white ${
                      hasNew
                        ? 'bg-gradient-to-br from-orange-400 to-red-500'
                        : 'bg-gradient-to-br from-gray-400 to-gray-500 dark:from-gray-600 dark:to-gray-700'
                    }`}>
                      {(session.customerName || session.tableNumber || '?').charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className={`text-sm font-bold truncate ${isActive ? 'text-orange-700 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
                          {session.customerName
                            ? session.customerName
                            : session.tableNumber
                            ? `Table ${session.tableNumber}`
                            : `Guest · ${session.id.slice(-4)}`}
                        </p>
                        <p className="text-[10px] text-gray-400 flex-shrink-0 ml-1">
                          {timeAgo(session.lastActivity || session.createdAt)}
                        </p>
                      </div>
                      {session.tableNumber && (
                        <p className="text-[10px] text-orange-500 font-semibold mb-0.5">🪑 Table {session.tableNumber}</p>
                      )}
                      {lastMsg && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {lastMsg.role === 'customer' ? '👤 ' : lastMsg.role === 'admin' ? '👨‍💼 ' : '🤖 '}
                          {lastMsg.text.replace(/\*\*/g, '').slice(0, 45)}...
                        </p>
                      )}
                    </div>

                    {/* Unread badge */}
                    {session.unread > 0 && (
                      <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center flex-shrink-0 shadow">
                        {session.unread > 9 ? '9+' : session.unread}
                      </span>
                    )}

                    {/* Delete button */}
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(session.id) }}
                      className="opacity-0 group-hover:opacity-100 absolute right-2 top-2 w-6 h-6 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                    >
                      <FiTrash2 size={11} />
                    </button>
                  </motion.button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Chat window ── */}
      <div className="flex-1 flex flex-col">
        {!activeId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity }}
              className="text-7xl mb-6">💬</motion.div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Select a conversation</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
              Choose a customer chat from the left to view messages and reply in real-time.
            </p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0 bg-white dark:bg-gray-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center shadow text-white font-black text-base">
                  {(activeSession?.customerName || activeSession?.tableNumber || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-black text-gray-900 dark:text-white text-sm">
                    {activeSession?.customerName || (activeSession?.tableNumber ? `Table ${activeSession.tableNumber}` : `Guest · ${activeId?.slice(-4)}`)}
                  </p>
                  <div className="flex items-center gap-2">
                    {activeSession?.tableNumber && (
                      <span className="text-xs text-orange-500 font-semibold">🪑 Table {activeSession.tableNumber}</span>
                    )}
                    {activeSession?.customerName && activeSession?.tableNumber && (
                      <span className="text-xs text-gray-400">·</span>
                    )}
                    <span className="text-xs text-gray-400">{messages.length} messages</span>
                  </div>
                </div>
              </div>
              <button onClick={() => handleDelete(activeId)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <FiTrash2 size={15} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-gray-50 dark:bg-gray-950">
              {messages.map(msg => (
                <motion.div key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === 'customer' ? 'flex-row' : 'flex-row-reverse'}`}
                >
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-1 shadow ${
                    msg.role === 'customer'
                      ? 'bg-gradient-to-br from-gray-400 to-gray-600'
                      : msg.role === 'admin'
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                      : 'bg-gradient-to-br from-orange-400 to-red-500'
                  }`}>
                    {msg.role === 'customer' ? '👤' : msg.role === 'admin' ? '👨‍💼' : '🤖'}
                  </div>

                  <div className={`max-w-[70%] flex flex-col gap-1 ${msg.role === 'customer' ? 'items-start' : 'items-end'}`}>
                    {msg.role === 'admin' && (
                      <p className="text-[10px] text-blue-500 font-bold mr-1">{msg.adminName || 'Staff'}</p>
                    )}
                    {msg.role === 'bot' && (
                      <p className="text-[10px] text-orange-500 font-bold ml-1">🤖 AI Assistant</p>
                    )}
                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      msg.role === 'customer'
                        ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm border border-gray-100 dark:border-gray-700'
                        : msg.role === 'admin'
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-tr-sm'
                        : 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 text-gray-800 dark:text-gray-200 rounded-tr-sm border border-orange-100 dark:border-orange-900/30'
                    }`}>
                      <RenderText text={msg.text} />
                    </div>
                    <p className="text-[10px] text-gray-400 px-1">
                      {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Reply box */}
            <div className="px-5 py-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
              {/* Quick reply suggestions */}
              <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-hide pb-1">
                {[
                  "Thank you for reaching out! 😊",
                  "Your order is being prepared 👨‍🍳",
                  "A waiter is on the way 🛎️",
                  "I'll check that for you right away!",
                  "We apologize for the inconvenience 🙏",
                  "Your order is ready! ✅",
                ].map((q, i) => (
                  <button key={i}
                    onClick={() => { setReply(q); textareaRef.current?.focus() }}
                    className="flex-shrink-0 text-xs font-medium px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-full hover:bg-blue-100 transition-colors whitespace-nowrap">
                    {q.slice(0, 28)}{q.length > 28 ? '...' : ''}
                  </button>
                ))}
              </div>

              <div className="flex items-end gap-3">
                <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3">
                  <textarea
                    ref={textareaRef}
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Type your reply to the customer..."
                    rows={2}
                    className="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 resize-none outline-none leading-relaxed"
                    style={{ scrollbarWidth: 'none' }}
                  />
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleSend}
                  disabled={!reply.trim() || sending}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg flex-shrink-0 transition-all ${
                    reply.trim() && !sending
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-200 dark:shadow-none'
                      : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                  }`}
                >
                  {sending ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full" />
                  ) : (
                    <FiSend size={18} />
                  )}
                </motion.button>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 text-center">Press Enter to send · Shift+Enter for new line</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
