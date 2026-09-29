import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { io } from 'socket.io-client'
import axios from 'axios'
import { FiSend, FiRefreshCw, FiCheck, FiTrash2, FiMessageSquare, FiUser, FiMail, FiClock, FiX } from 'react-icons/fi'

const API = import.meta.env.VITE_API_URL || '/api'

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

function authHeaders() {
  const token = localStorage.getItem('superadmin_token') || localStorage.getItem('token')
  return { Authorization: `Bearer ${token}` }
}

// ── Bubble renderer ───────────────────────────────────────────────────────────
function Bubble({ msg }) {
  const isAdmin   = msg.role === 'admin'
  const isBot     = msg.role === 'bot'
  const isVisitor = msg.role === 'visitor'

  const bgClass = isAdmin
    ? 'bg-amber-500 text-slate-950 self-end'
    : isBot
    ? 'bg-slate-700 text-slate-200 self-start'
    : 'bg-slate-800 text-white self-start'

  const label = isAdmin ? (msg.adminName || 'You') : isBot ? '🤖 Bot' : '👤 Visitor'

  // Render simple markdown bold **text**
  const renderText = (text) =>
    text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : part
    )

  return (
    <div className={`flex flex-col max-w-[78%] ${isAdmin ? 'self-end items-end' : 'self-start items-start'}`}>
      <span className="text-[10px] text-slate-500 mb-1 px-1">{label}</span>
      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${bgClass}`}>
        {renderText(msg.text)}
      </div>
      <span className="text-[10px] text-slate-600 mt-1 px-1">{timeAgo(msg.ts)}</span>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SupportChatPanel() {
  const [sessions, setSessions]       = useState([])
  const [activeId, setActiveId]       = useState(null)
  const [messages, setMessages]       = useState([])
  const [reply, setReply]             = useState('')
  const [sending, setSending]         = useState(false)
  const [loading, setLoading]         = useState(true)
  const [unreadMap, setUnreadMap]     = useState({})
  const messagesEndRef                = useRef(null)
  const socketRef                     = useRef(null)
  const activeIdRef                   = useRef(null)
  activeIdRef.current = activeId

  // ── Fetch session list ────────────────────────────────────────────────────
  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${API}/platform-chat/sessions`, { headers: authHeaders() })
      setSessions(res.data || [])
    } catch (err) {
      console.error('[SupportChatPanel] fetchSessions error:', err?.response?.status, err?.response?.data || err.message)
    }
    setLoading(false)
  }

  // ── Load messages for a session ───────────────────────────────────────────
  const loadSession = async (sessionId) => {
    try {
      const res = await axios.get(`${API}/platform-chat/${sessionId}`, { headers: authHeaders() })
      setMessages(res.data.messages || [])
      // Mark unread cleared
      setUnreadMap(prev => ({ ...prev, [sessionId]: 0 }))
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, unread: 0 } : s))
    } catch (_) {}
  }

  useEffect(() => {
    fetchSessions()

    // ── Connect socket & join superadmin-support room ─────────────────────
    const socket = io('/', { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[SupportChatPanel] socket connected, joining superadmin-support room')
      socket.emit('join_superadmin_support')
    })

    socket.on('connect_error', (err) => {
      console.error('[SupportChatPanel] socket connect_error:', err.message)
    })

    // New message from a visitor
    socket.on('platform_new_message', (data) => {
      const { sessionId, visitorName, visitorEmail, message, unread } = data

      // Update session list (add if new, update lastActivity + unread)
      setSessions(prev => {
        const exists = prev.find(s => s.id === sessionId)
        if (exists) {
          return prev.map(s => s.id === sessionId
            ? { ...s, lastActivity: message.ts, unread: activeIdRef.current === sessionId ? 0 : (s.unread || 0) + 1 }
            : s
          ).sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity))
        }
        // Brand new session
        return [{
          id: sessionId, visitorName, visitorEmail,
          lastActivity: message.ts, unread: 1, status: 'open', messages: [],
        }, ...prev]
      })

      // If this session is currently open, append message live
      if (activeIdRef.current === sessionId) {
        setMessages(prev => [...prev, message])
      } else {
        setUnreadMap(prev => ({ ...prev, [sessionId]: (prev[sessionId] || 0) + 1 }))
      }
    })

    // Confirm admin sent message reflected back
    socket.on('platform_admin_sent', ({ sessionId, message }) => {
      if (activeIdRef.current === sessionId) {
        setMessages(prev => {
          // Avoid duplicates (already added optimistically on send)
          if (prev.find(m => m.id === message.id)) return prev
          return [...prev, message]
        })
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  // Poll every 8 seconds as a safety net for sessions arriving before socket connected
  useEffect(() => {
    const pollInterval = setInterval(fetchSessions, 8000)
    return () => clearInterval(pollInterval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const openSession = (sessionId) => {
    setActiveId(sessionId)
    loadSession(sessionId)
  }

  const handleReply = async (e) => {
    e.preventDefault()
    if (!reply.trim() || !activeId || sending) return
    setSending(true)

    const optimistic = {
      role: 'admin',
      text: reply.trim(),
      ts: new Date().toISOString(),
      id: `opt-${Date.now()}`,
      adminName: 'MEGA Support',
    }
    setMessages(prev => [...prev, optimistic])
    setReply('')

    try {
      await axios.post(
        `${API}/platform-chat/${activeId}/reply`,
        { message: optimistic.text },
        { headers: authHeaders() }
      )
    } catch (_) {}
    setSending(false)
  }

  const handleResolve = async (sessionId) => {
    try {
      await axios.patch(`${API}/platform-chat/${sessionId}/resolve`, {}, { headers: authHeaders() })
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'resolved' } : s))
    } catch (_) {}
  }

  const handleDelete = async (sessionId) => {
    try {
      await axios.delete(`${API}/platform-chat/${sessionId}`, { headers: authHeaders() })
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      if (activeId === sessionId) { setActiveId(null); setMessages([]) }
    } catch (_) {}
  }

  const activeSession = sessions.find(s => s.id === activeId)

  return (
    <div className="h-[calc(100vh-7rem)] flex gap-5">

      {/* ── Session List ─────────────────────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FiMessageSquare className="text-amber-400" size={16} />
            <span className="font-bold text-white text-sm">Support Chats</span>
            {sessions.filter(s => s.unread > 0).length > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {sessions.reduce((acc, s) => acc + (s.unread || 0), 0)}
              </span>
            )}
          </div>
          <button onClick={fetchSessions} className="text-slate-500 hover:text-white transition-colors" title="Refresh">
            <FiRefreshCw size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-12 text-slate-500 text-sm">Loading…</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-slate-400 text-sm font-semibold">No support chats yet</p>
              <p className="text-slate-600 text-xs mt-1">Visitor messages from the website will appear here</p>
            </div>
          ) : (
            sessions.map(session => {
              const unread = unreadMap[session.id] || session.unread || 0
              const isActive = activeId === session.id
              return (
                <button
                  key={session.id}
                  onClick={() => openSession(session.id)}
                  className={`w-full text-left px-4 py-3.5 border-b border-slate-800 hover:bg-slate-800 transition-colors ${isActive ? 'bg-slate-800 border-l-2 border-l-amber-500' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-slate-950 font-black text-sm flex-shrink-0">
                      {(session.visitorName || 'V').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-white font-semibold text-xs truncate">{session.visitorName || 'Visitor'}</p>
                        <span className="text-[10px] text-slate-500 flex-shrink-0 ml-1">{timeAgo(session.lastActivity)}</span>
                      </div>
                      {session.visitorEmail && (
                        <p className="text-slate-500 text-[10px] truncate">{session.visitorEmail}</p>
                      )}
                      <div className="flex items-center justify-between mt-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${session.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                          {session.status === 'resolved' ? 'Resolved' : 'Open'}
                        </span>
                        {unread > 0 && (
                          <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                            {unread > 9 ? '9+' : unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── Chat Window ──────────────────────────────────────────────────── */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
        {!activeId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center text-4xl mb-4">💬</div>
            <h3 className="text-white font-bold text-lg mb-2">Platform Support Inbox</h3>
            <p className="text-slate-400 text-sm max-w-xs">
              Select a visitor conversation from the left to read and reply. Messages come from the website chat widget and contact form.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-800 flex-shrink-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-slate-950 font-black text-sm flex-shrink-0">
                {(activeSession?.visitorName || 'V').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm truncate">{activeSession?.visitorName || 'Visitor'}</p>
                {activeSession?.visitorEmail && (
                  <p className="text-slate-400 text-xs flex items-center gap-1">
                    <FiMail size={10} /> {activeSession.visitorEmail}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeSession?.status !== 'resolved' && (
                  <button
                    onClick={() => handleResolve(activeId)}
                    title="Mark resolved"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <FiCheck size={12} /> Resolve
                  </button>
                )}
                <button
                  onClick={() => handleDelete(activeId)}
                  title="Delete conversation"
                  className="w-8 h-8 flex items-center justify-center text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {messages.map(msg => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col"
                  >
                    <Bubble msg={msg} />
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Reply input */}
            <form onSubmit={handleReply} className="flex items-end gap-3 px-4 py-3 border-t border-slate-800 flex-shrink-0">
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(e) } }}
                placeholder="Type a reply… (Enter to send, Shift+Enter for new line)"
                rows={2}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
              />
              <button
                type="submit"
                disabled={!reply.trim() || sending}
                className="w-11 h-11 flex-shrink-0 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 rounded-xl flex items-center justify-center text-slate-950 transition-colors"
              >
                <FiSend size={16} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
