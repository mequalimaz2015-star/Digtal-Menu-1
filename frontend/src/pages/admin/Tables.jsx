import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiPlus, FiEdit2, FiTrash2, FiX, FiSave } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { useMenuStore } from '../../store/useMenuStore'

export default function Tables() {
  const { tables, addTable, updateTable, deleteTable } = useMenuStore()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ number: '', capacity: 4, status: 'available' })

  const openAdd = () => {
    setEditing(null)
    setForm({ number: '', capacity: 4, status: 'available' })
    setShowModal(true)
  }

  const openEdit = (table) => {
    setEditing(table)
    setForm({ number: table.number, capacity: table.capacity, status: table.status })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.number.trim()) { toast.error('Table number is required'); return }
    if (form.capacity < 1) { toast.error('Capacity must be at least 1'); return }
    try {
      if (editing) {
        await updateTable(editing.id, form)
        toast.success('✅ Table updated')
      } else {
        await addTable(form)
        toast.success('✅ Table created')
      }
      setShowModal(false)
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save table')
    }
  }

  const handleDelete = async (table) => {
    if (!confirm(`Delete Table ${table.number}?`)) return
    try {
      await deleteTable(table.id)
      toast.success('🗑️ Deleted')
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to delete table')
    }
  }

  const statusColors = {
    available: 'bg-green-500',
    occupied: 'bg-red-500',
    reserved: 'bg-yellow-500',
  }

  const statusLabels = {
    available: 'Available',
    occupied: 'Occupied',
    reserved: 'Reserved',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tables</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {tables.length} total · {tables.filter(t => t.status === 'available').length} available
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <FiPlus size={18} /> Add Table
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {tables.map((table, idx) => (
          <motion.div
            key={table.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.03 }}
            className="card relative"
          >
            <div className={`absolute top-3 right-3 w-3 h-3 rounded-full ${statusColors[table.status]}`} />
            
            <div className="text-center mb-3">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg mb-2">
                🪑
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">Table {table.number}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{table.capacity} seats</p>
            </div>

            <div className="mb-3">
              <select
                value={table.status}
                onChange={async (e) => {
                  try {
                    await updateTable(table.id, { ...table, status: e.target.value })
                    toast.success('Status updated')
                  } catch (err) {
                    toast.error(err?.response?.data?.error || 'Failed to update status')
                  }
                }}
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="available">🟢 Available</option>
                <option value="occupied">🔴 Occupied</option>
                <option value="reserved">🟡 Reserved</option>
              </select>
            </div>

            <div className="flex gap-1">
              <button onClick={() => openEdit(table)} className="flex-1 text-xs py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-semibold transition-colors">
                Edit
              </button>
              <button onClick={() => handleDelete(table)} className="flex-1 text-xs py-2 rounded-lg border border-red-200 dark:border-red-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold transition-colors">
                Delete
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showModal && (
          <Modal title={editing ? `Edit Table ${editing.number}` : 'Add Table'} onClose={() => setShowModal(false)} onSave={handleSave}>
            <div className="space-y-4">
              <div><label className="label">Table Number *</label><input value={form.number} onChange={e => setForm({...form, number: e.target.value})} placeholder="e.g. 1, VIP 1, Terrace 2" className="input-field" /></div>
              <div><label className="label">Capacity (Seats)</label><input type="number" min="1" value={form.capacity} onChange={e => setForm({...form, capacity: parseInt(e.target.value) || 1})} className="input-field" /></div>
              <div><label className="label">Initial Status</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="input-field"><option value="available">🟢 Available</option><option value="occupied">🔴 Occupied</option><option value="reserved">🟡 Reserved</option></select></div>
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
