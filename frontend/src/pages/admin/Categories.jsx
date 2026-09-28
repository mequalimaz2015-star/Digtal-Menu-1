import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiPlus, FiEdit2, FiTrash2, FiX, FiSave } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { useMenuStore } from '../../store/useMenuStore'

const emptyForm = { name: '', nameAm: '', icon: '🍽️', color: '#e85d04', sortOrder: 0 }

export default function Categories() {
  const { categories, addCategory, updateCategory, deleteCategory, toggleCategory } = useMenuStore()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const openAdd = () => {
    setEditing(null)
    setForm({ ...emptyForm, sortOrder: categories.length })
    setShowModal(true)
  }

  const openEdit = (cat) => {
    setEditing(cat)
    setForm({ name: cat.name, nameAm: cat.nameAm, icon: cat.icon, color: cat.color, sortOrder: cat.sortOrder })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    try {
      if (editing) {
        await updateCategory(editing.id, form)
        toast.success('✅ Category updated')
      } else {
        await addCategory(form)
        toast.success('✅ Category created')
      }
      setShowModal(false)
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save category')
    }
  }

  const handleDelete = async (cat) => {
    if (!confirm(`Delete "${cat.name}"? This cannot be undone.`)) return
    try {
      await deleteCategory(cat.id)
      toast.success('🗑️ Deleted')
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to delete category')
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Categories</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {categories.length} total · {categories.filter(c => c.isActive).length} active
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <FiPlus size={18} /> Add Category
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {categories.sort((a, b) => a.sortOrder - b.sortOrder).map((cat, idx) => (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
            className={`card ${!cat.isActive ? 'opacity-50' : ''}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-sm" style={{ backgroundColor: cat.color + '20' }}>
                {cat.icon}
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(cat)} className="icon-btn" title="Edit">
                  <FiEdit2 size={14} />
                </button>
                <button onClick={() => handleDelete(cat)} className="icon-btn text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete">
                  <FiTrash2 size={14} />
                </button>
              </div>
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-0.5">{cat.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{cat.nameAm || '—'}</p>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
              <span className="text-xs text-gray-400">Order: {cat.sortOrder}</span>
              <button onClick={async () => { try { await toggleCategory(cat.id) } catch { toast.error('Failed to toggle') } }} className={`toggle-btn ${cat.isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <span className={`toggle-dot ${cat.isActive ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <Modal title={editing ? 'Edit Category' : 'Add Category'} onClose={() => setShowModal(false)} onSave={handleSave}>
            <div className="space-y-4">
              <div>
                <label className="label">Name (English) *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Pizza" className="input-field" />
              </div>
              <div>
                <label className="label">Name (Amharic)</label>
                <input value={form.nameAm} onChange={e => setForm({...form, nameAm: e.target.value})} placeholder="e.g. ፒዛ" className="input-field" />
              </div>
              <div>
                <label className="label">Icon (Emoji)</label>
                <input value={form.icon} onChange={e => setForm({...form, icon: e.target.value})} placeholder="🍕" maxLength={2} className="input-field text-2xl text-center" />
              </div>
              <div>
                <label className="label">Color</label>
                <div className="flex gap-3">
                  <input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="h-12 w-20 rounded-xl cursor-pointer border-2 border-gray-200 dark:border-gray-700" />
                  <input type="text" value={form.color} onChange={e => setForm({...form, color: e.target.value})} placeholder="#e85d04" className="flex-1 input-field font-mono" />
                </div>
              </div>
              <div>
                <label className="label">Sort Order</label>
                <input type="number" value={form.sortOrder} onChange={e => setForm({...form, sortOrder: parseInt(e.target.value) || 0})} className="input-field" min="0" />
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}

function Modal({ title, onClose, onSave, children }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-backdrop" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} onClick={e => e.stopPropagation()} className="modal">
        <div className="modal-header">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="icon-btn"><FiX size={20} /></button>
        </div>
        <div className="p-5">{children}</div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={onSave} className="btn-primary"><FiSave size={18} /> Save</button>
        </div>
      </motion.div>
    </motion.div>
  )
}
