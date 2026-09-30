import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTenantNav } from '../../hooks/useTenantNav'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { FiArrowLeft, FiTrash2, FiMinus, FiPlus, FiShoppingBag } from 'react-icons/fi'
import useCartStore from '../../store/useCartStore'
import { restaurantInfo } from '../../data/mockData'
import BottomNav from '../../components/customer/BottomNav'
import OrderTypePicker from '../../components/customer/OrderTypePicker'

export default function CartPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { tNavigate } = useTenantNav()
  const language = i18n.language
  const { items, removeItem, updateQuantity, clearCart, orderType, setOrderType } = useCartStore()

  const subtotal = items.reduce((sum, item) => {
    const modTotal = (item.selectedModifiers || []).reduce((ms, m) => ms + (m.price || 0), 0)
    return sum + (item.price + modTotal) * item.quantity
  }, 0)

  const vat = subtotal * restaurantInfo.vatRate
  const serviceCharge = subtotal * restaurantInfo.serviceChargeRate
  const grandTotal = subtotal + vat + serviceCharge

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4 flex items-center gap-3 h-14">
          <button
            onClick={() => tNavigate('/menu')}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <FiArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex-1">
            {t('yourCart')}
          </h1>
          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="text-sm text-red-500 hover:text-red-600 font-medium"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-40">
        {items.length === 0 ? (
          <EmptyCart onBrowse={() => tNavigate('/menu')} t={t} />
        ) : (
          <>
            {/* Cart Items */}
            <div className="space-y-4 mb-8">
              <AnimatePresence>
                {items.map((item) => (
                  <CartItem
                    key={item.cartId}
                    item={item}
                    language={language}
                    onRemove={() => removeItem(item.cartId)}
                    onUpdateQuantity={(q) => updateQuantity(item.cartId, q)}
                    t={t}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Order Type Picker */}
            <OrderTypePicker
              value={orderType}
              onChange={setOrderType}
              language={language}
            />

            {/* Order Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 mb-4 border border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Order Summary</h3>
              <div className="space-y-3">
                <SummaryRow label={t('subtotal')} value={`${subtotal.toFixed(2)} ETB`} />
                <SummaryRow label={t('vat')} value={`${vat.toFixed(2)} ETB`} />
                <SummaryRow label={t('serviceCharge')} value={`${serviceCharge.toFixed(2)} ETB`} />
                <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                  <SummaryRow
                    label={t('grandTotal')}
                    value={`${grandTotal.toFixed(2)} ETB`}
                    bold
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Checkout Button */}
      {items.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 p-4 z-30">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => tNavigate('/checkout')}
              className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl hover:bg-orange-600 active:scale-[0.98] transition-all shadow-lg shadow-orange-200 dark:shadow-none text-lg"
            >
              {t('checkout')} • {grandTotal.toFixed(2)} ETB
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

function CartItem({ item, language, onRemove, onUpdateQuantity, t }) {
  const modTotal = (item.selectedModifiers || []).reduce((ms, m) => ms + (m.price || 0), 0)
  const itemTotal = (item.price + modTotal) * item.quantity

  return (
    <motion.div
      layout
      exit={{ opacity: 0, x: -100 }}
      className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm"
    >
      <div className="flex gap-4">
        {/* Image */}
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
          {item.image ? (
            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl">🍽️</div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1 line-clamp-1">
            {language === 'am' ? item.nameAm : item.name}
          </h3>

          {/* Modifiers */}
          {item.selectedModifiers?.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 line-clamp-2">
              {item.selectedModifiers.map((m) => m.name).join(', ')}
            </p>
          )}

          {/* Special instructions */}
          {item.specialInstructions && (
            <p className="text-xs text-orange-500 mb-2 italic line-clamp-1">
              📝 {item.specialInstructions}
            </p>
          )}

          <div className="flex items-center justify-between mt-2">
            {/* Quantity */}
            <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => onUpdateQuantity(item.quantity - 1)}
                className="w-7 h-7 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600 rounded-md"
              >
                <FiMinus size={13} />
              </button>
              <span className="w-6 text-center text-sm font-bold text-gray-900 dark:text-white">
                {item.quantity}
              </span>
              <button
                onClick={() => onUpdateQuantity(item.quantity + 1)}
                className="w-7 h-7 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600 rounded-md"
              >
                <FiPlus size={13} />
              </button>
            </div>

            <span className="text-orange-500 font-bold text-base">
              {itemTotal.toFixed(2)} ETB
            </span>
          </div>
        </div>

        {/* Remove */}
        <button
          onClick={onRemove}
          className="text-red-400 hover:text-red-600 self-start mt-1"
        >
          <FiTrash2 size={18} />
        </button>
      </div>
    </motion.div>
  )
}

function SummaryRow({ label, value, bold }) {
  return (
    <div className={`flex justify-between items-center ${bold ? 'text-base' : 'text-sm'}`}>
      <span className={bold ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}>
        {label}
      </span>
      <span className={bold ? 'font-bold text-orange-500' : 'text-gray-900 dark:text-white'}>
        {value}
      </span>
    </div>
  )
}

function EmptyCart({ onBrowse, t }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="text-8xl mb-5">🛒</div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {t('emptyCart')}
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8">{t('emptyCartSub')}</p>
      <button
        onClick={onBrowse}
        className="bg-orange-500 text-white font-bold px-8 py-4 rounded-2xl hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200 dark:shadow-none"
      >
        Browse Menu
      </button>
    </motion.div>
  )
}
