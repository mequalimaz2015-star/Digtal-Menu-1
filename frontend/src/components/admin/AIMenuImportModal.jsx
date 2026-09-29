/**
 * AIMenuImportModal.jsx
 *
 * Three-step wizard:
 *  STEP 1 — Choose mode: "Scan Menu Photo" or "Import Excel/CSV"
 *  STEP 2 — Upload file → backend analyses → show structured preview table
 *  STEP 3 — Confirm import → POST /api/menu-items/bulk → success summary
 */

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  FiUploadCloud, FiImage, FiFileText, FiX, FiCheck,
  FiDownload, FiAlertTriangle, FiEdit2, FiTrash2,
  FiChevronRight, FiZap, FiRefreshCw,
} from 'react-icons/fi'

const API = import.meta.env.VITE_API_URL || '/api'

function authHeaders() {
  const token = localStorage.getItem('token')
  return { Authorization: `Bearer ${token}` }
}

// ── Tiny editable cell ─────────────────────────────────────────────────────────
function EditCell({ value, onChange, type = 'text', className = '' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`w-full bg-transparent border-b border-transparent hover:border-slate-600 focus:border-amber-500 focus:outline-none px-1 py-0.5 text-xs ${className}`}
    />
  )
}

// ── Step indicator ─────────────────────────────────────────────────────────────
function Steps({ step }) {
  const steps = ['Choose Mode', 'AI Analysis', 'Review & Import']
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black transition-colors
            ${step > i ? 'bg-emerald-500 text-white' : step === i ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
            {step > i ? '✓' : i + 1}
          </div>
          <span className={`text-xs font-semibold hidden sm:inline ${step === i ? 'text-white' : 'text-slate-500'}`}>{s}</span>
          {i < steps.length - 1 && <div className="w-6 h-px bg-slate-700 hidden sm:block" />}
        </div>
      ))}
    </div>
  )
}

export default function AIMenuImportModal({ onClose, onImported }) {
  const [step, setStep]           = useState(0)          // 0=choose, 1=upload/analyse, 2=review
  const [mode, setMode]           = useState(null)        // 'image' | 'excel'
  const [file, setFile]           = useState(null)
  const [dragOver, setDragOver]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [loadMsg, setLoadMsg]     = useState('')
  const [preview, setPreview]     = useState(null)        // { categories, items }
  const [items, setItems]         = useState([])          // editable items
  const [categories, setCategories] = useState([])
  const [importing, setImporting] = useState(false)
  const [result, setResult]       = useState(null)        // import result
  const fileRef                   = useRef()

  // ── Update a single item field inline ────────────────────────────────────────
  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx))

  // ── Handle file drop / select ─────────────────────────────────────────────────
  const handleFile = useCallback((f) => {
    if (!f) return
    setFile(f)
  }, [])

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  // ── Analyse file ──────────────────────────────────────────────────────────────
  const analyse = async () => {
    if (!file) return
    setLoading(true)
    setLoadMsg(mode === 'image' ? '🔍 AI is scanning your menu image…' : '📊 Parsing your spreadsheet…')

    const form = new FormData()
    form.append('file', file)

    try {
      const endpoint = mode === 'image'
        ? `${API}/ai-menu-import/analyze-image`
        : `${API}/ai-menu-import/analyze-excel`

      const res = await axios.post(endpoint, form, {
        headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
      })

      const data = res.data
      if (data.warning) toast(data.warning, { icon: '⚠️', duration: 6000 })

      setPreview(data)
      setItems(data.items || [])
      setCategories(data.categories || [])
      setStep(2)
    } catch (err) {
      const msg = err.response?.data?.error || err.message
      toast.error(`Analysis failed: ${msg}`)
    }
    setLoading(false)
  }

  // ── Confirm import ────────────────────────────────────────────────────────────
  const confirmImport = async () => {
    const validItems = items.filter(i => i.name && i.price > 0)
    if (!validItems.length) { toast.error('No valid items to import (all need a name and price > 0).'); return }

    setImporting(true)
    try {
      const res = await axios.post(
        `${API}/menu-items/bulk`,
        { categories, items: validItems },
        { headers: authHeaders() }
      )
      setResult(res.data)
      toast.success(`✅ Imported ${res.data.created} items into ${res.data.categoriesCreated} categories!`)
      if (onImported) onImported()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed')
    }
    setImporting(false)
  }

  // ── Download template ─────────────────────────────────────────────────────────
  const downloadTemplate = async () => {
    try {
      const res = await axios.get(`${API}/ai-menu-import/template`, {
        headers: authHeaders(),
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url; a.download = 'mega_menu_template.xlsx'; a.click()
      URL.revokeObjectURL(url)
    } catch (_) {
      toast.error('Could not download template')
    }
  }

  // ── Group items by category for the review table ───────────────────────────────
  const grouped = items.reduce((acc, item, idx) => {
    const cat = item.categoryName || 'General'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push({ ...item, _idx: idx })
    return acc
  }, {})

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        className="relative w-full max-w-5xl bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl mt-8 mb-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-600 rounded-xl flex items-center justify-center text-slate-950 text-xl">
              <FiZap />
            </div>
            <div>
              <h2 className="text-white font-black text-lg">AI Menu Import</h2>
              <p className="text-slate-400 text-xs">Scan a menu photo or upload an Excel file — AI fills in the rest</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors">
            <FiX size={18} />
          </button>
        </div>

        <div className="px-6 py-5">
          <Steps step={step} />

          {/* ── STEP 0: Choose mode ── */}
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-slate-400 text-sm">How would you like to import your menu?</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Image mode */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setMode('image'); setStep(1) }}
                  className="group relative bg-slate-900 border-2 border-slate-700 hover:border-amber-500 rounded-2xl p-6 text-left transition-all"
                >
                  <div className="absolute top-4 right-4 text-[10px] font-bold px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">
                    AI POWERED
                  </div>
                  <div className="w-14 h-14 bg-gradient-to-br from-amber-400/20 to-orange-600/20 rounded-2xl flex items-center justify-center text-3xl mb-4">
                    📸
                  </div>
                  <h3 className="text-white font-bold text-base mb-2">Scan Menu Photo</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Take a photo of your physical menu or any food catalog. AI reads it and extracts every item with name, price, description, category, and ingredients automatically.
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-amber-400 text-sm font-semibold">
                    Get started <FiChevronRight size={16} />
                  </div>
                </motion.button>

                {/* Excel mode */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setMode('excel'); setStep(1) }}
                  className="group bg-slate-900 border-2 border-slate-700 hover:border-emerald-500 rounded-2xl p-6 text-left transition-all"
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-400/20 to-teal-600/20 rounded-2xl flex items-center justify-center text-3xl mb-4">
                    📊
                  </div>
                  <h3 className="text-white font-bold text-base mb-2">Import Excel / CSV</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Upload any Excel or CSV file — any column format works. The system auto-detects your columns, groups items by category, and optionally uses AI to fill missing descriptions.
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                    Get started <FiChevronRight size={16} />
                  </div>
                </motion.button>
              </div>

              {/* Template download */}
              <div className="flex items-center gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                <FiDownload className="text-amber-400 flex-shrink-0" size={18} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold">Download Excel Template</p>
                  <p className="text-slate-400 text-xs">Pre-formatted template with all supported columns and two sample rows.</p>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="flex-shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition-colors"
                >
                  Download
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 1: Upload file ── */}
          {step === 1 && (
            <div className="space-y-5">
              <button onClick={() => { setStep(0); setFile(null) }} className="text-slate-400 hover:text-white text-sm flex items-center gap-1 transition-colors">
                ← Back
              </button>

              <div className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-800 rounded-xl">
                {mode === 'image'
                  ? <><FiImage className="text-amber-400" size={16} /><span className="text-white text-sm font-semibold">Scan Menu Photo</span><span className="text-slate-500 text-xs ml-auto">JPG, PNG, WebP up to 15 MB</span></>
                  : <><FiFileText className="text-emerald-400" size={16} /><span className="text-white text-sm font-semibold">Import Excel / CSV</span><span className="text-slate-500 text-xs ml-auto">XLSX, XLS, CSV up to 15 MB</span></>
                }
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`relative cursor-pointer border-2 border-dashed rounded-2xl p-10 text-center transition-all
                  ${dragOver ? 'border-amber-500 bg-amber-500/5' : file ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-700 hover:border-slate-500'}`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept={mode === 'image' ? 'image/*' : '.xlsx,.xls,.csv'}
                  className="hidden"
                  onChange={e => handleFile(e.target.files[0])}
                />

                {file ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-4xl">{mode === 'image' ? '🖼️' : '📊'}</div>
                    <p className="text-white font-bold text-sm">{file.name}</p>
                    <p className="text-slate-400 text-xs">{(file.size / 1024).toFixed(0)} KB</p>
                    <button
                      onClick={e => { e.stopPropagation(); setFile(null) }}
                      className="text-red-400 text-xs hover:text-red-300 underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <FiUploadCloud size={40} className="text-slate-500" />
                    <p className="text-white font-semibold text-sm">
                      {dragOver ? 'Drop it here!' : `Drag & drop your ${mode === 'image' ? 'menu photo' : 'spreadsheet'} here`}
                    </p>
                    <p className="text-slate-500 text-xs">or click to browse</p>
                  </div>
                )}
              </div>

              {mode === 'image' && (
                <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs text-amber-300 space-y-1">
                  <p className="font-bold">💡 Tips for best results:</p>
                  <p>• Use a well-lit, clear photo of the full menu page</p>
                  <p>• Ensure text is readable — avoid blurry or angled shots</p>
                  <p>• Works with physical menus, digital screens, and food catalogs</p>
                </div>
              )}

              {mode === 'excel' && (
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 space-y-1">
                  <p className="font-bold">💡 Any column format is supported:</p>
                  <p>• The system auto-detects Name, Price, Category, Description columns</p>
                  <p>• You don't need to match the template exactly</p>
                  <p>• Missing descriptions will be filled by AI (if configured)</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-500 text-xs">
                  {file ? `Ready: ${file.name}` : 'No file selected'}
                </span>
                <button
                  onClick={analyse}
                  disabled={!file || loading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-40 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-amber-500/20"
                >
                  {loading
                    ? <><FiRefreshCw size={14} className="animate-spin" /> Analysing…</>
                    : <><FiZap size={14} /> Analyse with AI</>
                  }
                </button>
              </div>

              {loading && (
                <div className="text-center py-4">
                  <p className="text-amber-400 text-sm font-semibold animate-pulse">{loadMsg}</p>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Review & edit before import ── */}
          {step === 2 && !result && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                  <span className="text-emerald-400 font-bold text-sm">{items.length}</span>
                  <span className="text-emerald-300 text-xs">items detected</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
                  <span className="text-amber-400 font-bold text-sm">{categories.length}</span>
                  <span className="text-amber-300 text-xs">categories</span>
                </div>
                {preview?.source && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-full">
                    <span className="text-slate-400 text-xs">Source: {preview.source}</span>
                  </div>
                )}
                <button
                  onClick={() => { setStep(1); setFile(null); setPreview(null) }}
                  className="ml-auto text-slate-400 hover:text-white text-xs flex items-center gap-1"
                >
                  <FiRefreshCw size={12} /> Re-upload
                </button>
              </div>

              <p className="text-slate-400 text-xs">Review and edit items below before importing. Click any cell to edit inline. Remove items you don't want.</p>

              {/* Items table grouped by category */}
              <div className="overflow-auto max-h-[42vh] rounded-2xl border border-slate-800">
                <table className="w-full text-xs">
                  <thead className="bg-slate-900 sticky top-0 z-10">
                    <tr className="text-slate-400 text-left">
                      <th className="px-3 py-2.5 font-semibold w-8">#</th>
                      <th className="px-3 py-2.5 font-semibold w-20">Menu ID</th>
                      <th className="px-3 py-2.5 font-semibold min-w-[140px]">Name</th>
                      <th className="px-3 py-2.5 font-semibold min-w-[80px]">Price (ETB)</th>
                      <th className="px-3 py-2.5 font-semibold min-w-[200px]">Description</th>
                      <th className="px-3 py-2.5 font-semibold min-w-[140px]">Ingredients</th>
                      <th className="px-3 py-2.5 font-semibold w-16 text-center">🌶️</th>
                      <th className="px-3 py-2.5 font-semibold w-16 text-center">🥗</th>
                      <th className="px-3 py-2.5 font-semibold w-16 text-center">⭐</th>
                      <th className="px-3 py-2.5 font-semibold w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(grouped).map(([catName, catItems]) => (
                      <>
                        {/* Category header row */}
                        <tr key={`cat-${catName}`} className="bg-slate-900/80">
                          <td colSpan={9} className="px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{categories.find(c => c.name === catName)?.icon || '🍽️'}</span>
                              <span className="text-amber-400 font-bold text-xs uppercase tracking-wider">{catName}</span>
                              <span className="text-slate-600 text-[10px]">({catItems.length} items)</span>
                            </div>
                          </td>
                        </tr>
                        {catItems.map(item => (
                          <tr key={item._idx} className="border-t border-slate-800/60 hover:bg-slate-900/40 transition-colors">
                            <td className="px-3 py-2 text-slate-600">{item._idx + 1}</td>
                            <td className="px-3 py-2">
                              <span className="inline-block px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black tracking-wide whitespace-nowrap">
                                auto
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <EditCell value={item.name} onChange={v => updateItem(item._idx, 'name', v)} className="text-white font-medium" />
                              {item.nameAm && <p className="text-slate-500 text-[10px] mt-0.5">{item.nameAm}</p>}
                            </td>
                            <td className="px-3 py-2">
                              <EditCell value={item.price} onChange={v => updateItem(item._idx, 'price', parseFloat(v) || 0)} type="number" className="text-emerald-400 font-bold w-20" />
                            </td>
                            <td className="px-3 py-2 text-slate-300 max-w-[200px]">
                              <EditCell value={item.description} onChange={v => updateItem(item._idx, 'description', v)} />
                            </td>
                            <td className="px-3 py-2 text-slate-400 max-w-[140px]">
                              <EditCell value={item.ingredients} onChange={v => updateItem(item._idx, 'ingredients', v)} />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => updateItem(item._idx, 'isSpicy', !item.isSpicy)}
                                className={`text-base transition-opacity ${item.isSpicy ? 'opacity-100' : 'opacity-20'}`}
                              >🌶️</button>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => updateItem(item._idx, 'isVegetarian', !item.isVegetarian)}
                                className={`text-base transition-opacity ${item.isVegetarian ? 'opacity-100' : 'opacity-20'}`}
                              >🥗</button>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => updateItem(item._idx, 'isFeatured', !item.isFeatured)}
                                className={`text-base transition-opacity ${item.isFeatured ? 'opacity-100' : 'opacity-20'}`}
                              >⭐</button>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => removeItem(item._idx)}
                                className="text-red-500 hover:text-red-400 transition-colors"
                              >
                                <FiTrash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <p className="text-slate-600 text-[10px]">🌶️ Spicy &nbsp;·&nbsp; 🥗 Vegetarian &nbsp;·&nbsp; ⭐ Featured &nbsp;·&nbsp; Click cells to edit inline &nbsp;·&nbsp; 🗑️ Remove item</p>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <p className="text-slate-400 text-xs">
                  <span className="font-bold text-white">{items.filter(i => i.name && i.price > 0).length}</span> items ready to import
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setStep(1); setFile(null) }}
                    className="px-5 py-2.5 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-semibold transition-colors"
                  >
                    Re-upload
                  </button>
                  <button
                    onClick={confirmImport}
                    disabled={importing || items.filter(i => i.name && i.price > 0).length === 0}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-40 text-white font-bold text-sm rounded-xl transition-all shadow-lg"
                  >
                    {importing
                      ? <><FiRefreshCw size={14} className="animate-spin" /> Importing…</>
                      : <><FiCheck size={14} /> Import All Items</>
                    }
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Success summary ── */}
          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8 space-y-5"
            >
              <div className="text-6xl animate-bounce">🎉</div>
              <h3 className="text-white font-black text-2xl">Menu Imported!</h3>
              <p className="text-slate-400 text-sm">Your menu has been saved and is now live.</p>

              <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="text-2xl font-black text-emerald-400">{result.created}</div>
                  <div className="text-xs text-slate-400 mt-1">Items added</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="text-2xl font-black text-amber-400">{result.categoriesCreated}</div>
                  <div className="text-xs text-slate-400 mt-1">Categories</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="text-2xl font-black text-slate-400">{result.skipped}</div>
                  <div className="text-xs text-slate-400 mt-1">Skipped</div>
                </div>
              </div>

              {result.skippedNames?.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-left max-w-sm mx-auto">
                  <FiAlertTriangle className="text-amber-400 flex-shrink-0 mt-0.5" size={14} />
                  <div className="text-xs text-amber-300">
                    <p className="font-semibold mb-1">Skipped items (missing name or price):</p>
                    <p>{result.skippedNames.join(', ')}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-center pt-2">
                <button
                  onClick={() => { setStep(0); setFile(null); setPreview(null); setItems([]); setResult(null) }}
                  className="px-5 py-2.5 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  Import More
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm rounded-xl transition-colors"
                >
                  Done
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
