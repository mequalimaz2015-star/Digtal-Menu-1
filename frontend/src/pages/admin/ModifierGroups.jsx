import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiPlus, FiEdit2, FiTrash2, FiX, FiSave, FiChevronDown, FiChevronUp } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { useMenuStore } from '../../store/useMenuStore'

export default function ModifierGroups() {
  const { modifierGroups, addModifierGroup, updateModifierGroup, deleteModifierGroup, addModifier, updateModifier, deleteModifier } = useMenuStore()
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [showModModal, setShowModModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [editingMod, setEditingMod] = useState(null)
  const [activeGroup, setActiveGroup] = useState(null)
  const [groupForm, setGroupForm] = useState({ name: '', nameAm: '', required: false, multiSelect: false, maxSelect: 1 })
  const [modForm, setModForm] = useState({ name: '', nameAm: '', price: 0 })

  const openAddGroup = () => {
    setEditingGroup(null)
    setGroupForm({ name: '', nameAm: '', required: false, multiSelect: false, maxSelect: 1 })
    setShowGroupModal(true)
  }

  const openEditGroup = (group) => {
    setEditingGroup(group)
    setGroupForm({ name: group.name, nameAm: group.nameAm, required: group.required, multiSelect: group.multiSelect, maxSelect: group.maxSelect })
    setShowGroupModal(true)
  }

  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) { toast.error('Name is required'); return }
    try {
      if (editingGroup) {
        await updateModifierGroup(editingGroup.id, groupForm)
        toast.success('✅ Group updated')
      } else {
        await addModifierGroup(groupForm)
        toast.success('✅ Group created')
      }
      setShowGroupModal(false)
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save group')
    }
  }

  const handleDeleteGroup = async (group) => {
    if (!confirm(`Delete "${group.name}"?`)) return
    try {
      await deleteModifierGroup(group.id)
      toast.success('🗑️ Deleted')
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to delete group')
    }
  }

  const openAddModifier = (group) => {
    setActiveGroup(group)
    setEditingMod(null)
    setModForm({ name: '', nameAm: '', price: 0 })
    setShowModModal(true)
  }

  const openEditModifier = (group, mod) => {
    setActiveGroup(group)
    setEditingMod(mod)
    setModForm({ name: mod.name, nameAm: mod.nameAm, price: mod.price })
    setShowModModal(true)
  }

  const handleSaveMod = async () => {
    if (!modForm.name.trim()) { toast.error('Name is required'); return }
    try {
      if (editingMod) {
        await updateModifier(activeGroup.id, editingMod.id, modForm)
        toast.success('✅ Modifier updated')
      } else {
        await addModifier(activeGroup.id, modForm)
        toast.success('✅ Modifier added')
      }
      setShowModModal(false)
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save modifier')
    }
  }

  const handleDeleteMod = async (group, mod) => {
    if (!confirm(`Delete "${mod.name}"?`)) return
    try {
      await deleteModifier(group.id, mod.id)
      toast.success('🗑️ Deleted')
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to delete modifier')
    }
  }

  const [expanded, setExpanded] = useState({})
  const toggleExpand = (id) => setExpanded(s => ({ ...s, [id]: !s[id] }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Modifier Groups</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {modifierGroups.length} groups · {modifierGroups.reduce((sum, g) => sum + g.modifiers.length, 0)} modifiers
          </p>
        </div>
        <button onClick={openAddGroup} className="btn-primary">
          <FiPlus size={18} /> Add Group
        </button>
      </div>

      <div className="space-y-4">
        {modifierGroups.map((group, idx) => (
          <motion.div key={group.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }} className="card">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">{group.name}</h3>
                  {group.required && <span className="badge badge-red">Required</span>}
                  {group.multiSelect && <span className="badge badge-purple">Multi-select (max {group.maxSelect})</span>}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{group.nameAm || '—'}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEditGroup(group)} className="icon-btn"><FiEdit2 size={14} /></button>
                <button onClick={() => handleDeleteGroup(group)} className="icon-btn text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><FiTrash2 size={14} /></button>
                <button onClick={() => toggleExpand(group.id)} className="icon-btn">
                  {expanded[group.id] ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {expanded[group.id] && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Modifiers ({group.modifiers.length})</p>
                      <button onClick={() => openAddModifier(group)} className="text-xs bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-3 py-1.5 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 font-semibold transition-colors">
                        + Add Modifier
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {group.modifiers.length === 0 ? (
                        <p className="text-gray-400 dark:text-gray-500 text-sm col-span-full text-center py-4">No modifiers yet</p>
                      ) : (
                        group.modifiers.map(mod => (
                          <div key={mod.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{mod.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{mod.price > 0 ? `+${mod.price} ETB` : 'Free'}</p>
                            </div>
                            <div className="flex gap-1 ml-2">
                              <button onClick={() => openEditModifier(group, mod)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700"><FiEdit2 size={12} /></button>
                              <button onClick={() => handleDeleteMod(group, mod)} className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><FiTrash2 size={12} /></button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Group Modal */}
      <AnimatePresence>
        {showGroupModal && (
          <Modal title={editingGroup ? 'Edit Group' : 'Add Group'} onClose={() => setShowGroupModal(false)} onSave={handleSaveGroup}>
            <div className="space-y-4">
              <div><label className="label">Name (English) *</label><input value={groupForm.name} onChange={e => setGroupForm({...groupForm, name: e.target.value})} placeholder="e.g. Choose Size" className="input-field" /></div>
              <div><label className="label">Name (Amharic)</label><input value={groupForm.nameAm} onChange={e => setGroupForm({...groupForm, nameAm: e.target.value})} placeholder="e.g. መጠን ይምረጡ" className="input-field" /></div>
              <div><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={groupForm.required} onChange={e => setGroupForm({...groupForm, required: e.target.checked})} className="w-4 h-4 text-orange-500 rounded" /><span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Required (customer must select)</span></label></div>
              <div><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={groupForm.multiSelect} onChange={e => setGroupForm({...groupForm, multiSelect: e.target.checked})} className="w-4 h-4 text-orange-500 rounded" /><span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Allow multiple selection</span></label></div>
              {groupForm.multiSelect && (
                <div><label className="label">Max selections</label><input type="number" min="1" value={groupForm.maxSelect} onChange={e => setGroupForm({...groupForm, maxSelect: parseInt(e.target.value) || 1})} className="input-field" /></div>
              )}
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Modifier Modal */}
      <AnimatePresence>
        {showModModal && (
          <Modal title={editingMod ? 'Edit Modifier' : `Add Modifier to "${activeGroup?.name}"`} onClose={() => setShowModModal(false)} onSave={handleSaveMod}>
            <div className="space-y-4">
              <div><label className="label">Name (English) *</label><input value={modForm.name} onChange={e => setModForm({...modForm, name: e.target.value})} placeholder="e.g. Large" className="input-field" /></div>
              <div><label className="label">Name (Amharic)</label><input value={modForm.nameAm} onChange={e => setModForm({...modForm, nameAm: e.target.value})} placeholder="e.g. ትልቅ" className="input-field" /></div>
              <div><label className="label">Additional Price (ETB)</label><input type="number" step="0.01" value={modForm.price} onChange={e => setModForm({...modForm, price: parseFloat(e.target.value) || 0})} placeholder="0.00" className="input-field" /></div>
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
