import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { FiDownload, FiPrinter, FiGlobe, FiCopy, FiExternalLink } from 'react-icons/fi'
import { useMenuStore } from '../../store/useMenuStore'
import toast from 'react-hot-toast'

/**
 * QRCodes page — generates QR codes for each table.
 *
 * Key design decisions:
 * - Base URL defaults to window.location.origin (the deployed domain).
 *   On AletCloud this is https://digital-menu.app.aletcloud.com which works
 *   from ANY network / ANY device worldwide.
 * - Uses real tables from the database via useMenuStore, not hardcoded mockData.
 * - QR URL pattern: {origin}/t/{tableNumber} which maps to the customer menu
 *   with the table pre-selected.
 * - Admin can override to a local IP (e.g. for local Wi-Fi deployments) by
 *   editing the URL field.
 */
export default function QRCodes() {
  // Always default to the deployed origin — works from any network
  const [baseUrl, setBaseUrl] = useState(() => window.location.origin)
  const { tables } = useMenuStore()
  const svgRefs = useRef({})

  // Also get tenant slug for multi-tenant QR URLs
  const tenantSlug = localStorage.getItem('tenant_slug') || null

  // Build the QR URL for a table
  const getQrUrl = useCallback((tableNumber) => {
    if (tenantSlug && tenantSlug !== 'abc-restaurant') {
      return `${baseUrl}/r/${tenantSlug}/t/${tableNumber}`
    }
    return `${baseUrl}/t/${tableNumber}`
  }, [baseUrl, tenantSlug])

  const handleDownloadSvg = (tableNumber) => {
    const container = svgRefs.current[tableNumber]
    const svg = container?.querySelector('svg')
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `table-${tableNumber}-qr.svg`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`QR for Table ${tableNumber} downloaded`)
  }

  const handleDownloadPng = (tableNumber) => {
    const container = svgRefs.current[tableNumber]
    const svg = container?.querySelector('svg')
    if (!svg) return

    const canvas = document.createElement('canvas')
    const size = 400
    canvas.width = size
    canvas.height = size + 60
    const ctx = canvas.getContext('2d')

    // White background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Add table label
    ctx.fillStyle = '#1f2937'
    ctx.font = 'bold 22px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`Table ${tableNumber}`, size / 2, 40)

    const img = new Image()
    const svgBlob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' })
    const svgUrl = URL.createObjectURL(svgBlob)
    img.onload = () => {
      ctx.drawImage(img, 0, 50, size, size)
      URL.revokeObjectURL(svgUrl)
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `table-${tableNumber}-qr.png`
        a.click()
        URL.revokeObjectURL(url)
        toast.success(`QR for Table ${tableNumber} downloaded as PNG`)
      })
    }
    img.src = svgUrl
  }

  const handleCopyUrl = (tableNumber) => {
    navigator.clipboard.writeText(getQrUrl(tableNumber))
      .then(() => toast.success('URL copied to clipboard'))
      .catch(() => toast.error('Could not copy URL'))
  }

  const handlePrintAll = () => window.print()

  const statusColors = {
    available: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    occupied:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    reserved:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">QR Codes</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Customers scan these to open the menu on their phone from anywhere.
          </p>
        </div>
        <button
          onClick={handlePrintAll}
          className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-orange-600 transition-colors shadow"
        >
          <FiPrinter size={18} /> Print All
        </button>
      </div>

      {/* Base URL configuration */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-4 mb-6">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 bg-blue-500 text-white rounded-xl flex items-center justify-center flex-shrink-0">
            <FiGlobe size={20} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">Menu Base URL</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              This is the URL encoded into every QR code. Use your deployed domain so QR codes
              work from <strong>any network, any device, anywhere in the world</strong>.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value.replace(/\/+$/, ''))}
            className="flex-1 px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="https://your-domain.aletcloud.com"
          />
          <button
            onClick={() => setBaseUrl(window.location.origin)}
            className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
          >
            Use Current Domain
          </button>
        </div>

        {/* Show tip if URL looks like a local IP */}
        {(baseUrl.includes('192.168') || baseUrl.includes('10.') || baseUrl.includes('localhost')) && (
          <div className="mt-3 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
            <span className="text-lg flex-shrink-0">⚠️</span>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              <strong>Local IP detected!</strong> This URL only works on your local Wi-Fi network.
              For QR codes that work from anywhere (AletCloud, customer phones on mobile data),
              click <strong>"Use Current Domain"</strong> to use your deployed URL.
            </p>
          </div>
        )}

        {/* Preview first QR URL */}
        {tables.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-mono">
            Example: {getQrUrl(tables[0]?.number || '1')}
          </p>
        )}
      </div>

      {/* No tables message */}
      {tables.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🪑</p>
          <p className="font-semibold">No tables yet</p>
          <p className="text-sm mt-1">Add tables in the Tables section first</p>
        </div>
      )}

      {/* QR code grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
        {tables.map((table, idx) => {
          const qrUrl = getQrUrl(table.number)
          return (
            <motion.div
              key={table.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-center hover:shadow-md transition-shadow"
            >
              <h3 className="font-bold text-gray-900 dark:text-white mb-1 text-lg">
                Table {table.number}
              </h3>

              {/* Status badge */}
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize mb-4 inline-block ${statusColors[table.status] || statusColors.available}`}>
                {table.status}
              </span>

              {/* QR code */}
              <div
                ref={(el) => { svgRefs.current[table.number] = el }}
                className="flex justify-center mb-3 p-3 bg-white rounded-xl border border-gray-100"
              >
                <QRCodeSVG
                  value={qrUrl}
                  size={160}
                  level="H"
                  includeMargin
                  imageSettings={{
                    src: '/favicon.svg',
                    x: undefined,
                    y: undefined,
                    height: 30,
                    width: 30,
                    excavate: true,
                  }}
                />
              </div>

              {/* URL + open link */}
              <div className="flex items-center gap-1 justify-center mb-3">
                <p className="text-[10px] text-gray-400 break-all font-mono line-clamp-2 flex-1">
                  {qrUrl}
                </p>
                <a
                  href={qrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600 flex-shrink-0"
                  title="Open in new tab"
                >
                  <FiExternalLink size={13} />
                </a>
              </div>

              {/* Seat count */}
              <p className="text-xs text-gray-400 mb-3">{table.capacity} seats</p>

              {/* Action buttons */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleCopyUrl(table.number)}
                  title="Copy URL"
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-xs font-medium"
                >
                  <FiCopy size={12} /> Copy
                </button>
                <button
                  onClick={() => handleDownloadPng(table.number)}
                  title="Download PNG"
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors text-xs font-medium"
                >
                  <FiDownload size={12} /> PNG
                </button>
                <button
                  onClick={() => handleDownloadSvg(table.number)}
                  title="Download SVG"
                  className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-xs"
                >
                  SVG
                </button>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          .print-area { display: block !important; }
        }
      `}</style>
    </div>
  )
}
