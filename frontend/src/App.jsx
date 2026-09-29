import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import useAppStore from './store/useAppStore'

// Customer Pages
import HomePage from './pages/customer/HomePage'
import CartPage from './pages/customer/CartPage'
import CheckoutPage from './pages/customer/CheckoutPage'
import OrderConfirmation from './pages/customer/OrderConfirmation'
import ProfilePage from './pages/customer/ProfilePage'
import CategoriesPage from './pages/customer/CategoriesPage'
import OrderHistoryPage from './pages/customer/OrderHistoryPage'

// Admin Pages
import AdminLogin from './pages/admin/AdminLogin'
import AdminLayout from './pages/admin/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import Categories from './pages/admin/Categories'
import MenuItems from './pages/admin/MenuItems'
import ModifierGroups from './pages/admin/ModifierGroups'
import Tables from './pages/admin/Tables'
import QRCodes from './pages/admin/QRCodes'
import Orders from './pages/admin/Orders'
import KitchenDisplay from './pages/admin/KitchenDisplay'
import Reports from './pages/admin/Reports'
import Reviews from './pages/admin/Reviews'
import ChatPanel from './pages/admin/ChatPanel'
import Users from './pages/admin/Users'
import Settings from './pages/admin/Settings'
import AdminGuard from './components/auth/AdminGuard'
import OrderStatusMonitor from './components/customer/OrderStatusMonitor'
import ChatWidget from './components/customer/ChatWidget'
import WaiterPage from './pages/waiter/WaiterPage'

// Multi-Tenant SaaS & Super Admin Pages
import SuperAdminLogin from './pages/superadmin/SuperAdminLogin'
import SuperAdminLayout from './pages/superadmin/SuperAdminLayout'
import SuperAdminGuard from './components/auth/SuperAdminGuard'
import SADashboard from './pages/superadmin/SADashboard'
import SATenants from './pages/superadmin/SATenants'
import SAPlans from './pages/superadmin/SAPlans'
import SARevenue from './pages/superadmin/SARevenue'
import SAUsers from './pages/superadmin/SAUsers'
import SAActivity from './pages/superadmin/SAActivity'
import SAAnnouncements from './pages/superadmin/SAAnnouncements'
import SASettings from './pages/superadmin/SASettings'
import TenantRegistration from './pages/saas/TenantRegistration'
import RiderDashboard from './pages/rider/RiderDashboard'
import LandingPage from './pages/landing/LandingPage'

/**
 * CustomerShell — mounts OrderStatusMonitor + ChatWidget ONLY on customer-facing
 * pages. This means the notification socket is NEVER opened on the landing page,
 * admin panel, superadmin console, or any other non-customer route.
 */
function CustomerShell({ children }) {
  return (
    <>
      <OrderStatusMonitor />
      {children}
      <ChatWidget />
    </>
  )
}

export default function App() {
  const { darkMode } = useAppStore()

  useEffect(() => {
    const root = document.documentElement
    if (darkMode) {
      root.classList.add('dark')
      root.style.colorScheme = 'dark'
    } else {
      root.classList.remove('dark')
      root.style.colorScheme = 'light'
    }
  }, [darkMode])

  return (
    <BrowserRouter>
      <Routes>
        {/* ── Super Admin Console ─────────────────────────────────────────── */}
        <Route path="/superadmin/login" element={<SuperAdminLogin />} />
        <Route
          path="/superadmin"
          element={
            <SuperAdminGuard>
              <SuperAdminLayout />
            </SuperAdminGuard>
          }
        >
          <Route index element={<SADashboard />} />
          <Route path="tenants"       element={<SATenants />} />
          <Route path="plans"         element={<SAPlans />} />
          <Route path="revenue"       element={<SARevenue />} />
          <Route path="users"         element={<SAUsers />} />
          <Route path="activity"      element={<SAActivity />} />
          <Route path="announcements" element={<SAAnnouncements />} />
          <Route path="settings"      element={<SASettings />} />
        </Route>

        {/* ── SaaS Registration & Public Marketing ────────────────────────── */}
        <Route path="/register-tenant" element={<TenantRegistration />} />
        <Route path="/saas"            element={<TenantRegistration />} />
        <Route path="/"       element={<LandingPage />} />
        <Route path="/home"   element={<LandingPage />} />
        <Route path="/about"  element={<LandingPage />} />
        <Route path="/contact" element={<LandingPage />} />

        {/* ── Rider / Waiter portals (no customer notifications needed) ───── */}
        <Route path="/rider"  element={<RiderDashboard />} />
        <Route path="/waiter" element={<WaiterPage />} />

        {/* ── Restaurant Admin ─────────────────────────────────────────────── */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <AdminGuard>
              <AdminLayout />
            </AdminGuard>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="categories"  element={<Categories />} />
          <Route path="menu-items"  element={<MenuItems />} />
          <Route path="modifiers"   element={<ModifierGroups />} />
          <Route path="tables"      element={<Tables />} />
          <Route path="qr-codes"    element={<QRCodes />} />
          <Route path="orders"      element={<Orders />} />
          <Route path="kitchen"     element={<KitchenDisplay />} />
          <Route path="reports"     element={<Reports />} />
          <Route path="reviews"     element={<Reviews />} />
          <Route path="chat"        element={<ChatPanel />} />
          <Route path="users"       element={<Users />} />
          <Route path="settings"    element={<Settings />} />
        </Route>

        {/* ── Customer Pages — OrderStatusMonitor + ChatWidget only here ───── */}
        {/* Legacy single-tenant routes */}
        <Route path="/menu"                       element={<CustomerShell><HomePage /></CustomerShell>} />
        <Route path="/menu/:tableId"              element={<CustomerShell><HomePage /></CustomerShell>} />
        <Route path="/table/:tableId"             element={<CustomerShell><HomePage /></CustomerShell>} />
        <Route path="/t/:tableId"                 element={<CustomerShell><HomePage /></CustomerShell>} />
        <Route path="/scan"                       element={<CustomerShell><HomePage /></CustomerShell>} />
        <Route path="/cart"                       element={<CustomerShell><CartPage /></CustomerShell>} />
        <Route path="/checkout"                   element={<CustomerShell><CheckoutPage /></CustomerShell>} />
        <Route path="/order-confirmation/:orderId" element={<CustomerShell><OrderConfirmation /></CustomerShell>} />
        <Route path="/profile"                    element={<CustomerShell><ProfilePage /></CustomerShell>} />
        <Route path="/order-history"              element={<CustomerShell><OrderHistoryPage /></CustomerShell>} />
        <Route path="/categories"                 element={<CustomerShell><CategoriesPage /></CustomerShell>} />

        {/* Multi-tenant customer routes (/r/:tenantSlug/...) */}
        <Route path="/r/:tenantSlug"                              element={<CustomerShell><HomePage /></CustomerShell>} />
        <Route path="/r/:tenantSlug/menu"                         element={<CustomerShell><HomePage /></CustomerShell>} />
        <Route path="/r/:tenantSlug/menu/:tableId"                element={<CustomerShell><HomePage /></CustomerShell>} />
        <Route path="/r/:tenantSlug/t/:tableId"                   element={<CustomerShell><HomePage /></CustomerShell>} />
        <Route path="/r/:tenantSlug/categories"                   element={<CustomerShell><CategoriesPage /></CustomerShell>} />
        <Route path="/r/:tenantSlug/cart"                         element={<CustomerShell><CartPage /></CustomerShell>} />
        <Route path="/r/:tenantSlug/checkout"                     element={<CustomerShell><CheckoutPage /></CustomerShell>} />
        <Route path="/r/:tenantSlug/order-confirmation/:orderId"  element={<CustomerShell><OrderConfirmation /></CustomerShell>} />
        <Route path="/r/:tenantSlug/profile"                      element={<CustomerShell><ProfilePage /></CustomerShell>} />
        <Route path="/r/:tenantSlug/order-history"                element={<CustomerShell><OrderHistoryPage /></CustomerShell>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
