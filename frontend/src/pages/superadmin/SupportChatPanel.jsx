import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { io } from 'socket.io-client'
import { FiSend, FiRefreshCw, FiCheck, FiTrash2, FiMessageSquare, FiMail, FiAlertCircle } from 'react-icons/fi'

// Resolve API base — same logic as client.js but without going through the interceptor
// so tenant-slug headers and token confusion don't affect platform-chat requests
const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

function saToken() {
  return localStorage.getItem('superadmin_token') || localStorage.getItem('token') || ''
}

function authHeader() {
  return { Authorization: `Bearer ${saToken()}`, 'Content-Type': 'application/json' }
}

async function apiCall(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: authHeader(),
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let errMsg = res.statusText
    try { const j = await res.json(); errMsg = j.error || j.message || errMsg } catch (_) {}
    throw Object.assign(new Error(errMsg), { status: res.status })
  }
  if (res.status === 204) return null
  return res.json()
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 0) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

// Render **bold** markdown inline
function renderText(text) {
  return String(text).split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  )
}

function Bubble({ msg }) {
  const isAdmin   = msg.role === 'admin'
  const isBot     = msg.role === 'bot'
  const bgClass   = isAdmin
    ? 'bg-amber-500 text-slate-950'
    : isBot
    ? 'bg-slate-700 text-slate-200'
    : 'bg-slate-800 text-white'
  const label = isAdmin ? (msg.adminName || 'MEGA Support') : isBot ? '🤖 Bot' : '👤 Visitor'

  return (
    <div className={`flex flex-col max-w-[78%] ${isAdmin ? 'self-end items-end' : 'self-start items-start'}`}>
      <span className="text-[10px] text-slate-500 mb-0.5 px-1">{label}</span>
      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${bgClass}`}>
        {renderText(msg.text)}
      </div>
      <span className="text-[10px] text-slate-600 mt-0.5 px-1">{timeAgo(msg.ts)}</span>
    </div>
  )
}

export default function SupportChatPanel() {
  const [sessions,   setSessions]   = useState([])
  const [activeId,   setActiveId]   = useState(null)
  const [messages,   setMessages]   = useState([])
  const [reply,      setReply]      = useState('')
  const [sending,    setSending]    = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [apiError,   setApiError]   = useState(null)
  const [unreadMap,  setUnreadMap]  = useState({})

  const messagesEndRef = useRef(null)
  const socketRef      = useRef(null)
  const activeIdRef    = useRef(null)
  activeIdRef.current  = activeId

  // ── Fetch sessions using direct fetch — bypasses axios interceptors ─────────
  const fetchSessions = useCallback(async () => {
    setApiError(null)
    try {
      const data = await apiCall('GET', '/platform-chat/sessions')
      setSessions(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('[SupportChatPanel] fetchSessions failed:', err.status, err.message)
      setApiError(`${err.status ?? 'Network error'}: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSession = useCallback(async (sessionId) => {
    try {
      const data = await apiCall('GET', `/platform-chat/${sessionId}`)
      setMessages(data.messages || [])
      setUnreadMap(prev => ({ ...prev, [sessionId]: 0 }))
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, unread: 0 } : s))
    } catch (err) {
      console.error('[SupportChatPanel] loadSession error:', err.status, err.message)
    }
  }, [])

  // ── Socket.io setup ───────────────────────────────────────────────────────
  useEffect(() => {
    fetchSessions()

    const socket = io('/', { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[SupportChatPanel] socket connected:', socket.id)
      socket.emit('join_superadmin_support')
    })

    socket.on('connect_error', err => {
      console.error('[SupportChatPanel] socket error:', err.message)
    })

    socket.on('platform_new_message', (data) => {
      const { sessionId, visitorName, visitorEmail, message } = data
      console.log('[SupportChatPanel] platform_new_message received:', sessionId)

      setSessions(prev => {
        const exists = prev.find(s => s.id === sessionId)
        if (exists) {
          return prev
            .map(s => s.id === sessionId
              ? { ...s, lastActivity: message.ts, unread: activeIdRef.current === sessionId ? 0 : (s.unread || 0) + 1 }
              : s)
            .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity))
        }
        return [{
          id: sessionId, visitorName, visitorEmail,
          lastActivity: message.ts, unread: 1, status: 'open',
        }, ...prev]
      })

      if (activeIdRef.current === sessionId) {
        setMessages(prev => [...prev, message])
      } else {
        setUnreadMap(prev => ({ ...prev, [sessionId]: (prev[sessionId] || 0) + 1 }))
      }
    })

    socket.on('platform_admin_sent', ({ sessionId, message }) => {
      if (activeIdRef.current === sessionId) {
        setMessages(prev => prev.find(m => m.id === message.id) ? prev : [...prev, message])
      }
    })

    return () => socket.disconnect()
  }, [fetchSessions])

  // Poll every 6s as safety net
  useEffect(() => {
    const t = setInterval(fetchSessions, 6000)
    return () => clearInterval(t)
  }, [fetchSessions])

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

    try {
      const optimistic = {
        role: 'admin', text: reply.trim(),
        ts: new Date().toISOString(), id: `opt-${Date.now()}`, adminName: 'MEGA Support',
      }
      setMessages(prev => [...prev, optimistic])
      setReply('')

      await apiCall('POST', `/platform-chat/${activeId}/reply`, { message: optimistic.text })
    } catch (err) {
      console.error('[SupportChatPanel] reply error:', err.status, err.message)
    }
    setSending(false)
  }

  const handleResolve = async (sessionId) => {
    try {
      await apiCall('PATCH', `/platform-chat/${sessionId}/resolve`)
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'resolved' } : s))
    } catch (_) {}
  }

  const handleDelete = async (sessionId) => {
    try {
      await apiCall('DELETE', `/platform-chat/${sessionId}`)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      if (activeId === sessionId) { setActiveId(null); setMessages([]) }
    } catch (_) {}
  }

  const activeSession = sessions.find(s => s.id === activeId)

  return (
    <div className="h-[calc(100vh-7rem)] flex gap-5">

      {/* ── Session list ─────────────────────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FiMessageSquare className="text-amber-400" size={16} />
            <span className="font-bold text-white text-sm">Support Chats</span>
            {sessions.reduce((a, s) => a + (s.unread || 0), 0) > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {sessions.reduce((a, s) => a + (s.unread || 0), 0)}
              </span>
            )}
          </div>
          <button onClick={fetchSessions} title="Refresh" className="text-slate-500 hover:text-white transition-colors">
            <FiRefreshCw size={14} />
          </button>
        </div>

        {/* API error banner */}
        {apiError && (
          <div className="mx-3 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 text-xs text-red-400">
            <FiAlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-0.5">API Error</p>
              <p className="text-red-300/80">{apiError}</p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-12 text-slate-500 text-sm animate-pulse">Loading…</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-slate-400 text-sm font-semibold">No support chats yet</p>
              <p className="text-slate-600 text-xs mt-1">Visitor messages from the website will appear here</p>
            </div>
          ) : sessions.map(session => {
            const unread   = unreadMap[session.id] || session.unread || 0
            const isActive = activeId === session.id
            return (
              <button
                key={session.id}
                onClick={() => openSession(session.id)}
                className={`w-full text-left px-4 py-3.5 border-b border-slate-800 hover:bg-slate-800 transition-colors
                  ${isActive ? 'bg-slate-800 border-l-2 border-l-amber-500' : ''}`}
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
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                        ${session.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
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
          })}
        </div>
      </div>

      {/* ── Chat window ──────────────────────────────────────────────────── */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
        {!activeId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center text-4xl mb-4">💬</div>
            <h3 className="text-white font-bold text-lg mb-2">Platform Support Inbox</h3>
            <p className="text-slate-400 text-sm max-w-xs">
              Select a visitor conversation on the left. Messages arrive from the website chat widget and contact form in real-time.
            </p>
          </div>
        ) : (
          <>
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
                  <button onClick={() => handleResolve(activeId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg text-xs font-semibold transition-colors">
                    <FiCheck size={12} /> Resolve
                  </button>
                )}
                <button onClick={() => handleDelete(activeId)}
                  className="w-8 h-8 flex items-center justify-center text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                  <FiTrash2 size={14} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {messages.map(msg => (
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col">
                    <Bubble msg={msg} />
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleReply} className="flex items-end gap-3 px-4 py-3 border-t border-slate-800 flex-shrink-0">
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(e) } }}
                placeholder="Type a reply… (Enter to send)"
                rows={2}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
              />
              <button type="submit" disabled={!reply.trim() || sending}
                className="w-11 h-11 flex-shrink-0 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 rounded-xl flex items-center justify-center text-slate-950 transition-colors">
                <FiSend size={16} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
