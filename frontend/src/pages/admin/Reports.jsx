import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FiTrendingUp, FiTrendingDown, FiDollarSign, FiShoppingCart, 
  FiUsers, FiClock, FiDownload, FiFileText, FiGrid, FiList, FiFilter
} from 'react-icons/fi'
import { useMenuStore } from '../../store/useMenuStore'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import client from '../../api/client'

export default function Reports() {
  const { menuItems, categories } = useMenuStore()
  const [orders, setOrders] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [reportType, setReportType] = useState('all') // 'all', 'served', 'ready'
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  
  // Create applied filters so the filter waits for "SHOW" button
  const [appliedFilters, setAppliedFilters] = useState({ type: 'all', from: '', to: '' })
  
  // Fetch real data from DB
  const fetchOrders = async () => {
    try {
      const res = await client.get('/orders')
      const data = res.data
      if (!Array.isArray(data)) throw new Error('Invalid data format')
      
      const mapped = data.map(o => ({
        id: o.order_ref || String(o.id),
        dbId: o.id,
        tableNumber: o.table_number,
        customerName: o.customer_name,
        phone: o.phone,
        notes: o.notes,
        status: o.status,
        subtotal: o.subtotal,
        vat: o.vat,
        serviceCharge: o.service_charge,
        grandTotal: o.grand_total || o.total,
        estimatedTime: o.estimated_time,
        createdAt: o.created_at || o.createdAt,
        items: (o.items || []).map(i => ({
          name: i.menu_item_name || i.name,
          qty: i.quantity || i.qty,
          price: i.price,
        })),
      }))
      setOrders(mapped)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const handleShow = () => {
    setAppliedFilters({ type: reportType, from: dateFrom, to: dateTo })
  }

  const setQuickDate = (type) => {
    const d = new Date()
    if (type === 'yesterday') d.setDate(d.getDate() - 1)
    const localDateStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]
    setDateFrom(localDateStr)
    setDateTo(localDateStr)
    setAppliedFilters({ type: reportType, from: localDateStr, to: localDateStr })
  }

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // 1. Report Type Filter
      if (appliedFilters.type === 'served' && o.status !== 'served') return false
      if (appliedFilters.type === 'ready' && o.status !== 'ready') return false
      
      // 2. Date Filter
      if (appliedFilters.from || appliedFilters.to) {
        const oDate = new Date(o.createdAt).getTime()
        if (appliedFilters.from) {
          const fromTime = new Date(appliedFilters.from).getTime()
          if (oDate < fromTime) return false
        }
        if (appliedFilters.to) {
          const toTime = new Date(appliedFilters.to)
          toTime.setHours(23, 59, 59, 999)
          if (oDate > toTime.getTime()) return false
        }
      }
      return true
    })
  }, [orders, appliedFilters])

  const reportTitle = appliedFilters.type === 'served' ? 'Cash Sales Report' : appliedFilters.type === 'ready' ? 'Captain Order Report' : 'Sales Performance Overview'


  // Calculate actual revenue and stats from orders
  const todayRevenue = filteredOrders.reduce((sum, o) => sum + (o.grandTotal || o.total || 0), 0)
  const todayOrders = filteredOrders.length
  
  // Calculate Item Sales from actual orders
  const itemSalesMap = {}
  filteredOrders.forEach(o => {
    (o.items || []).forEach(item => {
      if (!itemSalesMap[item.name]) {
        itemSalesMap[item.name] = { name: item.name, qty: 0, revenue: 0 }
      }
      itemSalesMap[item.name].qty += item.qty
      itemSalesMap[item.name].revenue += item.price * item.qty
    })
  })
  
  const allItemSales = Object.values(itemSalesMap).sort((a, b) => b.qty - a.qty)
  const topSellers = allItemSales.slice(0, 5)

  // Mock comparison stats for UI appeal
  const yesterdayRevenue = 11500
  const yesterdayOrders = 43
  const avgPrepTime = 18
  const lastAvgPrepTime = 21

  const revenueChange = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100).toFixed(1)
  const ordersChange = ((todayOrders - yesterdayOrders) / yesterdayOrders * 100).toFixed(1)
  const prepTimeChange = avgPrepTime - lastAvgPrepTime

  const categoryStats = useMemo(() => {
    return categories.map(cat => {
      const itemCount = menuItems.filter(i => i.categoryId === cat.id).length
      // Calculate real category sales
      let soldToday = 0
      let catRevenue = 0
      filteredOrders.forEach(o => {
        (o.items || []).forEach(item => {
          const menuItemDetails = menuItems.find(m => m.name === item.name)
          if (menuItemDetails && menuItemDetails.categoryId === cat.id) {
            soldToday += item.qty
            catRevenue += item.price * item.qty
          }
        })
      })

      return {
        ...cat,
        itemCount,
        soldToday,
        catRevenue
      }
    }).sort((a, b) => b.soldToday - a.soldToday)
  }, [categories, menuItems, filteredOrders])

  // --- EXPORT FUNCTIONS ---
  const handleExportExcel = () => {
    const txnData = filteredOrders.map(o => ({
      'Order ID': o.id,
      'Date': new Date(o.createdAt).toLocaleString(),
      'Table / VIP': o.tableNumber,
      'Customer Name': o.customerName || 'N/A',
      'Items Summary': o.items.map(i => `${i.qty}x ${i.name}`).join(', '),
      'Subtotal (ETB)': o.subtotal || 0,
      'VAT (ETB)': o.vat || 0,
      'Total Paid (ETB)': o.grandTotal || o.total || 0,
       'Status': o.status
    }))

    const itemData = allItemSales.map(i => ({
      'Menu Item Name': i.name,
      'Quantity Sold': i.qty,
      'Generated Revenue (ETB)': i.revenue
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txnData), 'Transactions History')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemData), 'Item Sales')
    
    XLSX.writeFile(wb, `DigitalMenu_Report_${new Date().getTime()}.xlsx`)
  }

  const handleExportPDF = async () => {
    // Helper to preload the image logo
    const loadImage = (url) => new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'Anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    })

    const logoImg = await loadImage('/logo.png')
    const doc = new jsPDF()
    const restaurantName = 'ABC Restaurant' // Standardized setup, later fetched from context
    const restaurantAddress = 'Piazza, Addis Ababa, Ethiopia'
    const restaurantContact = '+251 911 123 456'

    // Custom Header & Footer callback for all pages
    const addHeaderFooter = (data) => {
      const pageWidth = doc.internal.pageSize.width
      const pageHeight = doc.internal.pageSize.height
      const centerX = pageWidth / 2

      // Logo centered
      if (logoImg) {
        const logoSize = 18
        doc.addImage(logoImg, 'PNG', centerX - logoSize / 2, 8, logoSize, logoSize)
      }

      // Restaurant Name centered
      doc.setFontSize(16)
      doc.setTextColor(249, 115, 22) // Orange brand
      doc.text(restaurantName, centerX, 32, { align: 'center' })

      // Address & Contact centered
      doc.setFontSize(9)
      doc.setTextColor(100)
      doc.text(restaurantAddress, centerX, 37, { align: 'center' })
      doc.text(`Contact: ${restaurantContact}`, centerX, 42, { align: 'center' })

      // Generated date — top right
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, 12, { align: 'right' })

      // Divider
      doc.setDrawColor(220)
      doc.line(14, 46, pageWidth - 14, 46)

      // Footer
      doc.setFontSize(9)
      doc.setTextColor(150)
      doc.text(`Page ${data.pageNumber}`, centerX, pageHeight - 10, { align: 'center' })
      doc.text(`© ${new Date().getFullYear()} ${restaurantName} — Powered by Digital Menu SaaS`, 14, pageHeight - 10)
    }
    
    // Summary — first page only (header drawn by didDrawPage)
    // Manually trigger header for first page
    addHeaderFooter({ pageNumber: 1 })

    doc.setFontSize(14)
    doc.setTextColor(40)
    doc.text(reportTitle, 14, 56)
    
    doc.setFontSize(11)
    doc.setTextColor(60)
    doc.text(`Total Orders: ${todayOrders}`, 14, 63)
    doc.text(`Total Revenue: ${todayRevenue.toLocaleString()} ETB`, 14, 69)

    // Item Sales Section
    autoTable(doc, {
      startY: 78,
      headStyles: { fillColor: [249, 115, 22] }, // Orange branding
      head: [['Item Name', 'Quantity Sold', 'Revenue (ETB)']],
      body: allItemSales.slice(0, 15).map(i => [i.name, i.qty, i.revenue.toLocaleString()]),
      didDrawPage: (data) => { if (data.pageNumber > 1) addHeaderFooter(data) },
      margin: { top: 52 }
    })

    // Transactions Section
    doc.setFontSize(14)
    doc.setTextColor(40)
    doc.text("Recent Transactions", 14, doc.lastAutoTable.finalY + 15)
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 22,
      headStyles: { fillColor: [43, 52, 64] },
      head: [['ID', 'Date', 'Amount (ETB)', 'Status', 'Items']],
      body: filteredOrders.slice(0, 30).map(o => [
        `#${o.id}`,
        new Date(o.createdAt).toLocaleDateString(),
        o.grandTotal || o.total,
        o.status,
        o.items.map(i => `${i.qty}x ${i.name}`).join(', ')
      ]),
      didDrawPage: addHeaderFooter,
      margin: { top: 35 }
    })

    doc.save(`DigitalMenu_Report_${new Date().getTime()}.pdf`)
  }

  return (
    <div className="pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Comprehensive overview and exports</p>
        </div>
        
        <div className="flex flex-col flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <select value={reportType} onChange={e => setReportType(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm text-gray-700 dark:text-gray-300">
               <option value="all">All Reports</option>
               <option value="served">Cash Sales Report (Served)</option>
               <option value="ready">Captain Order Report (Ready)</option>
            </select>
            <div className="flex items-center gap-1">
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm" />
              <span className="text-gray-400">to</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm" />
            </div>
            <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-2 lg:ml-1">
              <button onClick={() => setQuickDate('today')} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-300 transition-colors">Today</button>
              <button onClick={() => setQuickDate('yesterday')} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-300 transition-colors">Yesterday</button>
            </div>
            <button onClick={handleShow} className="flex items-center gap-2 px-4 py-2 ml-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-bold shadow-md shadow-orange-200 dark:shadow-none transition-colors">
              <FiFilter /> SHOW
            </button>
          </div>
          <div className="flex justify-end gap-2">
            <button 
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <FiFileText /> Export Excel
            </button>
            <button 
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <FiDownload /> Export PDF
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard icon={FiDollarSign} label="Total Revenue (Active)" value={`${todayRevenue.toLocaleString()} ETB`} change={revenueChange} up={revenueChange > 0} color="bg-green-500" />
        <StatCard icon={FiShoppingCart} label="Total Orders" value={todayOrders} change={ordersChange} up={ordersChange > 0} color="bg-blue-500" />
        <StatCard icon={FiClock} label="Avg. Prep Time" value={`${avgPrepTime} min`} change={prepTimeChange} up={prepTimeChange < 0} color="bg-orange-500" />
        <StatCard icon={FiUsers} label="Active Tables" value="6/8" change="" color="bg-purple-500" />
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl w-fit mb-6">
        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={FiGrid}>Overview</TabButton>
        <TabButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={FiList}>All Transactions</TabButton>
        <TabButton active={activeTab === 'items'} onClick={() => setActiveTab('items')} icon={FiShoppingCart}>Item Sales</TabButton>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Top Sellers */}
            <div className="xl:col-span-2 card">
              <h2 className="font-bold text-gray-900 dark:text-white mb-4 text-lg">🏆 Top Selling Items</h2>
              <div className="space-y-3">
                {topSellers.map((item, idx) => (
                  <motion.div key={item.name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-500 font-bold text-xl">
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white line-clamp-1">{item.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.qty} portions sold today</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-orange-500">{item.revenue.toLocaleString()} ETB</p>
                    </div>
                  </motion.div>
                ))}
                {topSellers.length === 0 && <p className="text-gray-500 text-sm py-4">No active sales recorded yet.</p>}
              </div>
            </div>

            {/* Category Stats */}
            <div className="card">
              <h2 className="font-bold text-gray-900 dark:text-white mb-4 text-lg">📊 By Category (Sales)</h2>
              <div className="space-y-3">
                {categoryStats.slice(0, 8).map((cat, idx) => (
                  <motion.div key={cat.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: cat.color + '20' }}>
                        {cat.icon}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">{cat.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{cat.itemCount} items mapped</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{cat.soldToday}</p>
                      <p className="text-xs text-gray-400">sold</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'transactions' && (
          <motion.div key="transactions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="card !p-0 overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-bold text-gray-900 dark:text-white text-lg">{reportTitle} Transactions</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-sm">
                    <th className="px-5 py-3 font-semibold pb-3">Order ID</th>
                    <th className="px-5 py-3 font-semibold pb-3">Date & Time</th>
                    <th className="px-5 py-3 font-semibold pb-3">Customer / Table</th>
                    <th className="px-5 py-3 font-semibold pb-3 max-w-[200px]">Items</th>
                    <th className="px-5 py-3 font-semibold pb-3">Status</th>
                    <th className="px-5 py-3 font-semibold pb-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredOrders.map(o => (
                    <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-5 py-4 text-sm font-bold text-gray-900 dark:text-white">#{o.id}</td>
                      <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(o.createdAt).toLocaleString()}</td>
                      <td className="px-5 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        {o.customerName || 'Walk-in'} <span className="opacity-50 text-xs inline-block ml-1">(T: {o.tableNumber})</span>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500 dark:text-gray-400 max-w-[200px] truncate" title={o.items.map(i => `${i.qty}x ${i.name}`).join(', ')}>
                        {o.items.map(i => `${i.qty}x ${i.name}`).join(', ')}
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 capitalize">{o.status}</span>
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-orange-500 text-right">
                        {(o.grandTotal || o.total || 0).toLocaleString()} ETB
                      </td>
                    </tr>
                  ))}
                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-5 py-8 text-center text-sm text-gray-500">No transactions recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'items' && (
          <motion.div key="items" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="card !p-0 overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-bold text-gray-900 dark:text-white text-lg">Menu Item Sales Performance</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-sm">
                    <th className="px-5 py-3 font-semibold pb-3">Item Name</th>
                    <th className="px-5 py-3 font-semibold pb-3 text-right">Quantity Sold</th>
                    <th className="px-5 py-3 font-semibold pb-3 text-right">Generated Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {allItemSales.map(i => (
                    <tr key={i.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-5 py-4 text-sm font-semibold text-gray-900 dark:text-white">{i.name}</td>
                      <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400 text-right">{i.qty}</td>
                      <td className="px-5 py-4 text-sm font-bold text-orange-500 text-right">
                        {i.revenue.toLocaleString()} ETB
                      </td>
                    </tr>
                  ))}
                  {allItemSales.length === 0 && (
                    <tr>
                      <td colSpan="3" className="px-5 py-8 text-center text-sm text-gray-500">No items sold yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, change, up, color }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 ${color} rounded-xl flex items-center justify-center text-white shadow-lg`}>
          <Icon size={20} />
        </div>
        {change && (
          <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${up ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
            {up ? <FiTrendingUp size={12} /> : <FiTrendingDown size={12} />}
            {change > 0 ? '+' : ''}{change}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
    </motion.div>
  )
}

function TabButton({ children, active, onClick, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all ${
        active 
        ? 'bg-white dark:bg-gray-700 text-orange-500 shadow-sm' 
        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
      }`}
    >
      <Icon size={16} />
      {children}
    </button>
  )
}
