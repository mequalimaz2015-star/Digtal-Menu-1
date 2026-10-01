import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiPlus, FiEdit2, FiTrash2, FiX, FiSave, FiEye, FiEyeOff, FiRefreshCw } from 'react-icons/fi'
import toast from 'react-hot-toast'
import client from '../../api/client'

const ROLE_META = {
  admin:   { label: 'Admin',   icon: '👑', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  manager: { label: 'Manager', icon: '💼', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  barista: { label: 'Barista', icon: '☕', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  kitchen: { label: 'Kitchen', icon: '👨‍🍳', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  waiter:  { label: 'Waiter',  icon: '🛎️', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
}

const emptyForm = { name: '', email: '', password: '', role: 'waiter', is_active: true }

export default function Users() {
  const [users,     setUsers]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [form,      setForm]      = useState(emptyForm)
  const [showPass,  setShowPass]  = useState(false)

  // ── Fetch users from API ────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await client.get('/users')
      setUsers(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // ── Open modals ─────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowPass(false)
    setShowModal(true)
  }

  const openEdit = (user) => {
    setEditing(user)
    setForm({
      name:      user.name      || '',
      email:     user.email     || '',
      password:  '',
      role:      user.role      || 'waiter',
      is_active: user.is_active === true || user.is_active === 1,
    })
    setShowPass(false)
    setShowModal(true)
  }

  // ── Save (create or update) ─────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim())  { toast.error('Name is required');  return }
    if (!form.email.trim()) { toast.error('Email is required'); return }
    if (!editing && !form.password) { toast.error('Password is required for new users'); return }

    setSaving(true)
    try {
      if (editing) {
        // Only send password if it was changed
        const payload = {
          name:      form.name,
          email:     form.email,
          role:      form.role,
          is_active: form.is_active,
          ...(form.password ? { password: form.password } : {}),
        }
        await client.put(`/users/${editing.id}`, payload)
        toast.success('✅ User updated')
      } else {
        await client.post('/users', {
          name:      form.name,
          email:     form.email,
          password:  form.password,
          role:      form.role,
          is_active: form.is_active,
        })
        toast.success('✅ User created — they can now log in with these credentials')
      }
      setShowModal(false)
      fetchUsers()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save user')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (user) => {
    const me = JSON.parse(localStorage.getItem('admin-user') || '{}')
    if (user.email === me.email) { toast.error('You cannot delete your own account'); return }
    if (!confirm(`Delete "${user.name}"? This cannot be undone.`)) return
    try {
      await client.delete(`/users/${user.id}`)
      toast.success('🗑️ User deleted')
      fetchUsers()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete user')
    }
  }

  // ── Toggle active ───────────────────────────────────────────────────────────
  const toggleActive = async (user) => {
    const next = !(user.is_active === true || user.is_active === 1)
    try {
      await client.put(`/users/${user.id}`, {
        name:      user.name,
        email:     user.email,
        role:      user.role,
        is_active: next,
      })
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: next } : u))
      toast.success(next ? '✅ User activated' : '⛔ User deactivated')
    } catch (err) {
      toast.error('Failed to update status')
    }
  }

  const isActive = (u) => u.is_active === true || u.is_active === 1

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Staff Users</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {users.length} users · {users.filter(isActive).length} active
            <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
              · Users you add here can log in to the admin portal
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchUsers} className="icon-btn" title="Refresh">
            <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openAdd} className="btn-primary">
            <FiPlus size={18} /> Add User
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="card animate-pulse">
              <div className="w-14 h-14 rounded-2xl bg-gray-200 dark:bg-gray-700 mb-4" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* User cards */}
      {!loading && (
        <>
          {users.length === 0 ? (
            <div className="card text-center py-16">
              <p className="text-4xl mb-3">👥</p>
              <p className="text-gray-600 dark:text-gray-300 font-bold text-lg">No staff users yet</p>
              <p className="text-gray-400 text-sm mt-1 mb-4">Add waiters, kitchen staff, and managers so they can log in</p>
              <button onClick={openAdd} className="btn-primary mx-auto">
                <FiPlus size={16} /> Add First User
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.map((user, idx) => {
                const meta   = ROLE_META[user.role] || ROLE_META.waiter
                const active = isActive(user)
                return (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`card ${!active ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-2xl font-black shadow-md shadow-orange-200 dark:shadow-none select-none">
                        {(user.name || user.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(user)} className="icon-btn" title="Edit">
                          <FiEdit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(user)} className="icon-btn text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete">
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <h3 className="font-bold text-gray-900 dark:text-white mb-0.5 truncate">{user.name || '—'}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 truncate">{user.email}</p>

                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.cls}`}>
                        <span>{meta.icon}</span>{meta.label}
                      </span>
                      <button
                        onClick={() => toggleActive(user)}
                        className={`toggle-btn ${active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                        title={active ? 'Click to deactivate' : 'Click to activate'}
                      >
                        <span className={`toggle-dot ${active ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Add / Edit Modal ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="modal-backdrop" onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()} className="modal"
            >
              <div className="modal-header">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editing ? `Edit: ${editing.name}` : 'Add Staff User'}
                </h2>
                <button onClick={() => setShowModal(false)} className="icon-btn"><FiX size={20} /></button>
              </div>

              <div className="p-5 space-y-4">
                {/* Info banner for new users */}
                {!editing && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs">
                    💡 After saving, this user can log in at <strong>/admin/login</strong> with the email and password you set here.
                  </div>
                )}

                <div>
                  <label className="label">Full Name *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Meron Haile"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="label">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="meron@yourrestaurant.com"
                    className="input-field"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label className="label">
                    {editing ? 'New Password (leave blank to keep current)' : 'Password *'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      placeholder={editing ? '••••••• (unchanged)' : 'Min. 6 characters'}
                      className="input-field pr-12"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showPass ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label">Role</label>
                  <select
                    value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value })}
                    className="input-field"
                  >
                    <option value="admin">👑 Admin — Full access</option>
                    <option value="manager">💼 Manager — No users/settings</option>
                    <option value="barista">☕ Barista — Menu + Orders</option>
                    <option value="kitchen">👨‍🍳 Kitchen — Kitchen display only</option>
                    <option value="waiter">🛎️ Waiter — Orders + Reviews</option>
                  </select>
                </div>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm({ ...form, is_active: e.target.checked })}
                    className="w-4 h-4 text-orange-500 rounded"
                  />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Active — user can log in
                  </span>
                </label>
              </div>

              <div className="modal-footer">
                <button onClick={() => setShowModal(false)} className="btn-secondary" disabled={saving}>
                  Cancel
                </button>
                <button onClick={handleSave} className="btn-primary" disabled={saving}>
                  {saving ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><FiSave size={16} /> Save User</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
