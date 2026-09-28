import { useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiImage, FiX, FiSave, FiDownload, FiUpload } from 'react-icons/fi'
import { BsFire, BsLeaf } from 'react-icons/bs'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { useMenuStore } from '../../store/useMenuStore'


const emptyForm = {
  name: '', nameAm: '', description: '', descriptionAm: '', price: '', categoryId: '',
  image: '', prepTime: 15, calories: '', isSpicy: false, isVegetarian: false,
  isAvailable: true, isFeatured: false, isPopular: false, isBestSeller: false,
  chefRecommended: false, discount: 0, allergens: '', rating: 4.5,
}

export default function MenuItems() {
  const { menuItems, categories, addMenuItem, updateMenuItem, deleteMenuItem, toggleAvailable } = useMenuStore()
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const fileInputRef = useRef(null)

  const handleExport = () => {
    const exportData = menuItems.map(item => ({
      'Name (English)': item.name,
      'Name (Amharic)': item.nameAm || '',
      'Description (English)': item.description || '',
      'Description (Amharic)': item.descriptionAm || '',
      'Price': item.price,
      'Category ID': item.categoryId,
      'Image URL': item.image || '',
      'Prep Time': item.prepTime || 15,
      'Calories': item.calories || '',
      'Is Spicy': item.isSpicy ? 'Yes' : 'No',
      'Is Vegetarian': item.isVegetarian ? 'Yes' : 'No',
      'Is Available': item.isAvailable ? 'Yes' : 'No',
      'Is Featured': item.isFeatured ? 'Yes' : 'No',
      'Is Popular': item.isPopular ? 'Yes' : 'No',
      'Is Best Seller': item.isBestSeller ? 'Yes' : 'No',
      'Chef Recommended': item.chefRecommended ? 'Yes' : 'No',
      'Discount (%)': item.discount || 0,
      'Allergens': Array.isArray(item.allergens) ? item.allergens.join(',') : '',
      'Rating': item.rating || 4.5
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "MenuItems")
    XLSX.writeFile(wb, "menu_items.xlsx")
  }

  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws)
        
        let successCount = 0
        for (const row of data) {
          if (!row['Name (English)'] || !row['Price'] || !row['Category ID']) continue

          const payload = {
            name: String(row['Name (English)']),
            nameAm: row['Name (Amharic)'] ? String(row['Name (Amharic)']) : '',
            description: row['Description (English)'] ? String(row['Description (English)']) : '',
            descriptionAm: row['Description (Amharic)'] ? String(row['Description (Amharic)']) : '',
            price: Number(row['Price']),
            categoryId: String(row['Category ID']),
            image: row['Image URL'] ? String(row['Image URL']) : '',
            prepTime: Number(row['Prep Time']) || 15,
            calories: row['Calories'] ? Number(row['Calories']) : null,
            isSpicy: String(row['Is Spicy']).toLowerCase() === 'yes',
            isVegetarian: String(row['Is Vegetarian']).toLowerCase() === 'yes',
            isAvailable: String(row['Is Available']).toLowerCase() !== 'no',
            isFeatured: String(row['Is Featured']).toLowerCase() === 'yes',
            isPopular: String(row['Is Popular']).toLowerCase() === 'yes',
            isBestSeller: String(row['Is Best Seller']).toLowerCase() === 'yes',
            chefRecommended: String(row['Chef Recommended']).toLowerCase() === 'yes',
            discount: Number(row['Discount (%)']) || 0,
            allergens: row['Allergens'] ? String(row['Allergens']).split(',').map(s=>s.trim()) : [],
            rating: Number(row['Rating']) || 4.5
          }
          await addMenuItem(payload)
          successCount++
        }
        toast.success(`Imported ${successCount} items successfully!`)
      } catch (err) {
        toast.error('Failed to parse Excel file')
        console.error(err)
      }
      e.target.value = null
    }
    reader.readAsBinaryString(file)
  }

  const filtered = useMemo(() => {
    return menuItems.filter(item => {
      const matchCat = catFilter === 'all' || item.categoryId === catFilter
      const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || (item.nameAm || '').toLowerCase().includes(search.toLowerCase())
      return matchCat && matchSearch
    })
  }, [menuItems, catFilter, search])

  const openAdd = () => {
    setEditing(null)
    setForm({ ...emptyForm, categoryId: categories[0]?.id || '' })
    setShowModal(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({
      name: item.name, nameAm: item.nameAm || '', description: item.description || '', descriptionAm: item.descriptionAm || '',
      price: item.price, categoryId: item.categoryId, image: item.image || '', prepTime: item.prepTime || 15,
      calories: item.calories || '', isSpicy: !!item.isSpicy, isVegetarian: !!item.isVegetarian,
      isAvailable: !!item.isAvailable, isFeatured: !!item.isFeatured, isPopular: !!item.isPopular,
      isBestSeller: !!item.isBestSeller, chefRecommended: !!item.chefRecommended, discount: item.discount || 0,
      allergens: Array.isArray(item.allergens) ? item.allergens.join(', ') : '', rating: item.rating || 4.5,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (!form.price || isNaN(form.price) || Number(form.price) <= 0) { toast.error('Valid price required'); return }
    if (!form.categoryId) { toast.error('Select a category'); return }

    const payload = {
      ...form,
      price: Number(form.price),
      prepTime: Number(form.prepTime) || 15,
      calories: form.calories ? Number(form.calories) : null,
      discount: Number(form.discount) || 0,
      rating: Number(form.rating) || 4.5,
      allergens: form.allergens.split(',').map(s => s.trim()).filter(Boolean),
    }

    try {
      if (editing) {
        await updateMenuItem(editing.id, payload)
        toast.success('✅ Item updated')
      } else {
        await addMenuItem(payload)
        toast.success('✅ Item added')
      }
      setShowModal(false)
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save item')
    }
  }

  const handleDelete = async (item) => {
    if (!confirm(`Delete "${item.name}"?`)) return
    try {
      await deleteMenuItem(item.id)
      toast.success('🗑️ Deleted')
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to delete item')
    }
  }

  const getCat = (catId) => categories.find(c => c.id === catId || String(c.id) === String(catId))

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Menu Items</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {menuItems.length} items · {menuItems.filter(i => i.isAvailable).length} available
          </p>
        </div>
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} onChange={handleImport} accept=".xlsx,.xls,.csv" className="hidden" />
          <button onClick={() => setShowImportModal(true)} className="btn-secondary flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            <FiUpload size={16} /> Import
          </button>
          <button onClick={handleExport} className="btn-secondary flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            <FiDownload size={16} /> Export
          </button>
          <button onClick={openAdd} className="btn-primary">
            <FiPlus size={18} /> Add Item
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name..." className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400">
          <option value="all">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🍽️</p>
            <p className="text-gray-500 dark:text-gray-400 font-semibold">No items found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr className="text-gray-500 dark:text-gray-400 text-left">
                  <th className="px-5 py-3.5 font-semibold">Item</th>
                  <th className="px-4 py-3.5 font-semibold">Category</th>
                  <th className="px-4 py-3.5 font-semibold">Price</th>
                  <th className="px-4 py-3.5 font-semibold">Tags</th>
                  <th className="px-4 py-3.5 font-semibold">Available</th>
                  <th className="px-4 py-3.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const cat = getCat(item.categoryId)
                  return (
                    <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.02 }} className={`border-t border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${!item.isAvailable ? 'opacity-60' : ''}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                            {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">🍽️</div>}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white line-clamp-1">{item.name}</p>
                            <p className="text-xs text-gray-400">{item.nameAm}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {cat ? `${cat.icon} ${cat.name}` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-gray-900 dark:text-white">{Number(item.price).toFixed(0)} ETB</span>
                        {item.discount > 0 && <div className="text-xs text-red-500">-{item.discount}%</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {item.isSpicy && <span className="badge badge-red"><BsFire size={9} /> Spicy</span>}
                          {item.isVegetarian && <span className="badge badge-green"><BsLeaf size={9} /> Veg</span>}
                          {item.isFeatured && <span className="badge badge-purple">⭐</span>}
                          {item.isBestSeller && <span className="badge badge-amber">🔥</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={async () => { try { await toggleAvailable(item.id) } catch { toast.error('Failed to update') } }} className={`toggle-btn ${item.isAvailable ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                          <span className={`toggle-dot ${item.isAvailable ? 'left-5' : 'left-0.5'}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(item)} className="icon-btn"><FiEdit2 size={14} /></button>
                          <button onClick={() => handleDelete(item)} className="icon-btn text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><FiTrash2 size={14} /></button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showModal && (
          <ItemModal
            title={editing ? `Edit: ${editing.name}` : 'Add Menu Item'}
            form={form}
            setForm={setForm}
            categories={categories}
            onClose={() => setShowModal(false)}
            onSave={handleSave}
          />
        )}
        {showImportModal && (
          <ImportHelpModal 
            onClose={() => setShowImportModal(false)} 
            onProceed={() => fileInputRef.current?.click()} 
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function ImportHelpModal({ onClose, onProceed }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-backdrop" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} onClick={e => e.stopPropagation()} className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100 dark:border-gray-800 flex flex-col">
        <div className="modal-header">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">How to Import Items</h2>
          <button onClick={onClose} className="icon-btn"><FiX size={20} /></button>
        </div>
        <div className="p-6 space-y-4 text-gray-700 dark:text-gray-300">
          <p className="font-semibold text-gray-900 dark:text-white">Follow these simple steps:</p>
          <ol className="list-decimal pl-5 space-y-2 text-sm leading-relaxed">
            <li>Click <b>Export</b> first to download the Excel template containing all your current items and the correct columns.</li>
            <li>Open the downloaded Excel file and add your new products using the same format.</li>
            <li>For the <b>Image URL</b>, you can arrange your images, upload them (like Imgur) and paste the link here.</li>
            <li>Make sure required fields (Name, Price, Category ID) are filled.</li>
            <li>Save the Excel file, then click <b>Continue to Upload</b> below to select it!</li>
          </ol>
          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-100 dark:border-orange-800 text-orange-800 dark:text-orange-300 text-sm mt-4">
            💡 <b>Pro tip:</b> You can find Category IDs in your export file!
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => { onClose(); onProceed(); }} className="btn-primary"><FiUpload size={18} /> Continue to Upload</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function ItemModal({ title, form, setForm, categories, onClose, onSave }) {
  const [tab, setTab] = useState('basic')
  const imageInputRef = useRef(null)

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    const reader = new FileReader()
    reader.onload = (evt) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        const maxDim = 800
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        setForm(prev => ({ ...prev, image: dataUrl }))
        toast.success('📷 Image uploaded successfully!')
      }
      img.onerror = () => {
        setForm(prev => ({ ...prev, image: evt.target.result }))
        toast.success('📷 Image uploaded successfully!')
      }
      img.src = evt.target.result
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const tabs = [
    { id: 'basic', label: '📝 Basic', },
    { id: 'details', label: '🔍 Details' },
    { id: 'flags', label: '🏷️ Flags' },
  ]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-backdrop" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} onClick={e => e.stopPropagation()} className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-100 dark:border-gray-800 max-h-[85vh] flex flex-col">
        
        {/* Header */}
        <div className="modal-header">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="icon-btn"><FiX size={20} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 px-5">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-3 text-sm font-semibold transition-colors relative ${tab === t.id ? 'text-orange-500' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
              {t.label}
              {tab === t.id && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {tab === 'basic' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="label">Name (English) *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Margherita Pizza" className="input-field" /></div>
                <div className="col-span-2"><label className="label">Name (Amharic)</label><input value={form.nameAm} onChange={e => setForm({...form, nameAm: e.target.value})} placeholder="e.g. ማርጌሪታ ፒዛ" className="input-field" /></div>
                <div><label className="label">Category *</label><select value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})} className="input-field"><option value="">Select</option>{categories.map(c => (<option key={c.id} value={c.id}>{c.icon} {c.name}</option>))}</select></div>
                <div><label className="label">Price (ETB) *</label><input type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="0.00" className="input-field" /></div>
                
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Image URL or Upload File</label>
                    {form.image && (
                      <button 
                        type="button" 
                        onClick={() => setForm({...form, image: ''})} 
                        className="text-xs text-red-500 hover:underline font-medium flex items-center gap-1"
                      >
                        <FiX size={12} /> Clear Image
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    <input 
                      value={form.image} 
                      onChange={e => setForm({...form, image: e.target.value})} 
                      placeholder="Paste image URL or click upload button →" 
                      className="input-field flex-1" 
                    />
                    
                    <label 
                      htmlFor="modal-menu-image-file-input"
                      title="Click to upload image file from your device"
                      className="w-14 h-14 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-orange-500 dark:hover:border-orange-500 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all relative group shadow-sm shrink-0"
                    >
                      <input 
                        id="modal-menu-image-file-input"
                        type="file" 
                        onChange={handleImageUpload} 
                        accept="image/*" 
                        className="hidden" 
                      />
                      {form.image ? (
                        <>
                          <img src={form.image} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity text-center p-0.5">
                            <FiUpload size={16} />
                            <span className="text-[8px] font-bold uppercase mt-0.5">Change</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-400 group-hover:text-orange-500 transition-colors">
                          <FiUpload size={20} />
                          <span className="text-[9px] font-bold mt-0.5 uppercase tracking-wider">Upload</span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <div className="col-span-2"><label className="label">Description (English)</label><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} placeholder="Brief description..." className="input-field resize-none" /></div>
                <div className="col-span-2"><label className="label">Description (Amharic)</label><textarea value={form.descriptionAm} onChange={e => setForm({...form, descriptionAm: e.target.value})} rows={2} placeholder="Brief description in Amharic..." className="input-field resize-none" /></div>
              </div>
            </>
          )}

          {tab === 'details' && (
            <div className="grid grid-cols-3 gap-4">
              <div><label className="label">Prep Time (min)</label><input type="number" value={form.prepTime} onChange={e => setForm({...form, prepTime: e.target.value})} className="input-field" /></div>
              <div><label className="label">Calories</label><input type="number" value={form.calories} onChange={e => setForm({...form, calories: e.target.value})} placeholder="Optional" className="input-field" /></div>
              <div><label className="label">Discount (%)</label><input type="number" min="0" max="100" value={form.discount} onChange={e => setForm({...form, discount: e.target.value})} className="input-field" /></div>
              <div className="col-span-3"><label className="label">Allergens (comma-separated)</label><input value={form.allergens} onChange={e => setForm({...form, allergens: e.target.value})} placeholder="e.g. Gluten, Dairy, Nuts" className="input-field" /></div>
              <div><label className="label">Rating (1-5)</label><input type="number" step="0.1" min="1" max="5" value={form.rating} onChange={e => setForm({...form, rating: e.target.value})} className="input-field" /></div>
            </div>
          )}

          {tab === 'flags' && (
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'isSpicy', label: 'Spicy', icon: '🌶️', desc: 'Mark as spicy dish' },
                { key: 'isVegetarian', label: 'Vegetarian', icon: '🥬', desc: 'Suitable for vegetarians' },
                { key: 'isAvailable', label: 'Available', icon: '✅', desc: 'Currently available' },
                { key: 'isFeatured', label: 'Featured', icon: '⭐', desc: 'Show in featured section' },
                { key: 'isPopular', label: 'Popular', icon: '🔥', desc: 'Mark as popular dish' },
                { key: 'isBestSeller', label: 'Best Seller', icon: '🏆', desc: 'Best selling item' },
                { key: 'chefRecommended', label: "Chef's Pick", icon: '👨‍🍳', desc: 'Chef recommendation' },
              ].map(f => (
                <label key={f.key} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${form[f.key] ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
                  <input type="checkbox" checked={form[f.key]} onChange={e => setForm({...form, [f.key]: e.target.checked})} className="mt-0.5 w-4 h-4 text-orange-500 rounded focus:ring-orange-400" />
                  <div className="flex-1"><div className="font-semibold text-gray-900 dark:text-white text-sm">{f.icon} {f.label}</div><div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{f.desc}</div></div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={onSave} className="btn-primary"><FiSave size={18} /> Save Item</button>
        </div>
      </motion.div>
    </motion.div>
  )
}
