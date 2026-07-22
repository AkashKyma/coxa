import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { useClubAnalyticsGlobal } from "./lib/useClubAnalytics.js";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import DashboardLayout from "./layouts/DashboardLayout.jsx";
import { AiChatWidget } from "@coxa/ui-analytics";
import { MODULE, usePermissions } from "./lib/permissions.js";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import OverviewPage from "./pages/OverviewPage.jsx";
import RolesPage from "./pages/RolesPage.jsx";
import UsersPage from "./pages/UsersPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import RetailProductsPage from "./pages/retail/RetailProductsPage.jsx";
import RetailLocationsPage from "./pages/retail/RetailLocationsPage.jsx";
import RetailStockPage from "./pages/retail/RetailStockPage.jsx";
import RetailSalesPage from "./pages/retail/RetailSalesPage.jsx";
import RetailReturnsPage from "./pages/retail/RetailReturnsPage.jsx";
import RetailTransfersPage from "./pages/retail/RetailTransfersPage.jsx";
import RetailCategoriesPage from "./pages/retail/RetailCategoriesPage.jsx";
import SaleQrRedemptionPage from "./pages/retail/SaleQrRedemptionPage.jsx";
import FoodInventoryPage from "./pages/fnb/FoodInventoryPage.jsx";
import FnbSalesDashboardPage from "./pages/fnb/FnbSalesDashboardPage.jsx";
import FnbProductsPage from "./pages/fnb/FnbProductsPage.jsx";
import LoyaltyRulesPage from "./pages/loyalty/LoyaltyRulesPage.jsx";
import LoyaltyTierConfigPage from "./pages/loyalty/LoyaltyTierConfigPage.jsx";
import CdpEventsPage from "./pages/cdp/CdpEventsPage.jsx";
import CdpSegmentsPage from "./pages/cdp/CdpSegmentsPage.jsx";
import CdpCustomer360Page from "./pages/cdp/CdpCustomer360Page.jsx";
import TicketingEventsPage from "./pages/ticketing/TicketingEventsPage.jsx";
import TicketingEventDetailPage from "./pages/ticketing/TicketingEventDetailPage.jsx";
import TicketingVenuesPage from "./pages/ticketing/TicketingVenuesPage.jsx";
import CheckInDashboardPage from "./pages/ticketing/CheckInDashboardPage.jsx";
import TicketingSupportPage from "./pages/ticketing/TicketingSupportPage.jsx";
import PersonalizationDashboardPage from "./pages/personalization/PersonalizationDashboardPage.jsx";
import OffersPage from "./pages/personalization/OffersPage.jsx";
import OfferFormPage from "./pages/personalization/OfferFormPage.jsx";
import MembershipPlansPage from "./pages/membership/MembershipPlansPage.jsx";
import MembersPage from "./pages/membership/MembersPage.jsx";
import MemberDetailPage from "./pages/membership/MemberDetailPage.jsx";
import PriorityRankingPage from "./pages/membership/PriorityRankingPage.jsx";
import ClubAnalyticsDashboardPage from "./pages/analytics/ClubAnalyticsDashboardPage.jsx";
import AutomationWorkflowsPage from "./pages/automation/AutomationWorkflowsPage.jsx";
import EmailCampaignsPage from "./pages/channels/EmailCampaignsPage.jsx";

/**
 * Route guard: redirects to "/" if the user's role doesn't grant access
 * to the given module key. Must be used inside AuthProvider.
 */
function ModuleRoute({ module: moduleKey, children }) {
  const { can, isAdmin } = usePermissions();
  const { loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: "2rem", color: "var(--coxa-text-muted)" }}>
        Loading module…
      </div>
    );
  }

  if (isAdmin || can(moduleKey)) return children;
  return <Navigate to="/" replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </ErrorBoundary>
  );
}

function AppInner() {
  const { user } = useAuth();
  useClubAnalyticsGlobal();
  return (
    <>
      <ProtectedRoute>
        <Routes>
          <Route element={<DashboardLayout />}>
            {/* Always visible */}
            <Route index element={<OverviewPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="analytics" element={<ClubAnalyticsDashboardPage />} />

            {/* Admin-only */}
            <Route
              path="roles"
              element={
                <ModuleRoute module={MODULE.ADMIN}>
                  <RolesPage />
                </ModuleRoute>
              }
            />
            <Route
              path="users"
              element={
                <ModuleRoute module={MODULE.ADMIN}>
                  <UsersPage />
                </ModuleRoute>
              }
            />

            {/* Retail */}
            <Route
              path="retail/products"
              element={
                <ModuleRoute module={MODULE.RETAIL}>
                  <RetailProductsPage />
                </ModuleRoute>
              }
            />
            <Route
              path="retail/categories"
              element={
                <ModuleRoute module={MODULE.RETAIL}>
                  <RetailCategoriesPage />
                </ModuleRoute>
              }
            />
            <Route
              path="retail/locations"
              element={
                <ModuleRoute module={MODULE.RETAIL}>
                  <RetailLocationsPage />
                </ModuleRoute>
              }
            />
            <Route
              path="retail/stock"
              element={
                <ModuleRoute module={MODULE.RETAIL}>
                  <RetailStockPage />
                </ModuleRoute>
              }
            />
            <Route
              path="retail/transfers"
              element={
                <ModuleRoute module={MODULE.RETAIL}>
                  <RetailTransfersPage />
                </ModuleRoute>
              }
            />
            <Route
              path="retail/sales"
              element={
                <ModuleRoute module={MODULE.RETAIL}>
                  <RetailSalesPage />
                </ModuleRoute>
              }
            />
            <Route
              path="retail/returns"
              element={
                <ModuleRoute module={MODULE.RETAIL}>
                  <RetailReturnsPage />
                </ModuleRoute>
              }
            />
            {/* QR redemption accessible from both Retail and FnB */}
            <Route path="retail/qr-redeem" element={<SaleQrRedemptionPage />} />
            <Route path="retail/qr-scanner" element={<Navigate to="/retail/qr-redeem" replace />} />
            <Route path="fnb/qr-redeem" element={<SaleQrRedemptionPage />} />

            {/* F&B */}
            <Route
              path="fnb/products"
              element={
                <ModuleRoute module={MODULE.FNB}>
                  <FnbProductsPage />
                </ModuleRoute>
              }
            />
            <Route
              path="fnb/inventory"
              element={
                <ModuleRoute module={MODULE.FNB}>
                  <FoodInventoryPage />
                </ModuleRoute>
              }
            />
            <Route
              path="fnb/sales"
              element={
                <ModuleRoute module={MODULE.FNB}>
                  <FnbSalesDashboardPage />
                </ModuleRoute>
              }
            />

            {/* Ticketing */}
            <Route
              path="ticketing/events"
              element={
                <ModuleRoute module={MODULE.TICKETING}>
                  <TicketingEventsPage />
                </ModuleRoute>
              }
            />
            <Route
              path="ticketing/events/:id"
              element={
                <ModuleRoute module={MODULE.TICKETING}>
                  <TicketingEventDetailPage />
                </ModuleRoute>
              }
            />
            <Route
              path="ticketing/venues"
              element={
                <ModuleRoute module={MODULE.TICKETING}>
                  <TicketingVenuesPage />
                </ModuleRoute>
              }
            />
            <Route
              path="ticketing/check-in"
              element={
                <ModuleRoute module={MODULE.TICKETING}>
                  <CheckInDashboardPage />
                </ModuleRoute>
              }
            />
            <Route
              path="ticketing/support"
              element={
                <ModuleRoute module={MODULE.SUPPORT}>
                  <TicketingSupportPage />
                </ModuleRoute>
              }
            />

            {/* CDP */}
            <Route
              path="cdp/events"
              element={
                <ModuleRoute module={MODULE.CDP}>
                  <CdpEventsPage />
                </ModuleRoute>
              }
            />
            <Route
              path="cdp/segments"
              element={
                <ModuleRoute module={MODULE.CDP}>
                  <CdpSegmentsPage />
                </ModuleRoute>
              }
            />
            <Route
              path="cdp/customer-360"
              element={
                <ModuleRoute module={MODULE.CDP}>
                  <CdpCustomer360Page />
                </ModuleRoute>
              }
            />
            <Route
              path="cdp/workflows"
              element={
                <ModuleRoute module={MODULE.CDP}>
                  <AutomationWorkflowsPage />
                </ModuleRoute>
              }
            />

            {/* Personalization */}
            <Route
              path="personalization"
              element={
                <ModuleRoute module={MODULE.PERSONALIZATION}>
                  <PersonalizationDashboardPage />
                </ModuleRoute>
              }
            />
            <Route
              path="personalization/offers"
              element={
                <ModuleRoute module={MODULE.PERSONALIZATION}>
                  <OffersPage />
                </ModuleRoute>
              }
            />
            <Route
              path="personalization/offers/:id"
              element={
                <ModuleRoute module={MODULE.PERSONALIZATION}>
                  <OfferFormPage />
                </ModuleRoute>
              }
            />

            {/* Loyalty */}
            <Route
              path="loyalty"
              element={
                <ModuleRoute module={MODULE.LOYALTY}>
                  <LoyaltyRulesPage />
                </ModuleRoute>
              }
            />
            <Route
              path="loyalty/tiers"
              element={
                <ModuleRoute module={MODULE.LOYALTY}>
                  <LoyaltyTierConfigPage />
                </ModuleRoute>
              }
            />

            {/* Membership */}
            <Route
              path="membership/plans"
              element={
                <ModuleRoute module={MODULE.MEMBERSHIP}>
                  <MembershipPlansPage />
                </ModuleRoute>
              }
            />
            <Route
              path="membership/members"
              element={
                <ModuleRoute module={MODULE.MEMBERSHIP}>
                  <MembersPage />
                </ModuleRoute>
              }
            />
            <Route
              path="membership/members/:id"
              element={
                <ModuleRoute module={MODULE.MEMBERSHIP}>
                  <MemberDetailPage />
                </ModuleRoute>
              }
            />
            <Route path="membership/priority"
              element={
                <ModuleRoute module={MODULE.MEMBERSHIP}>
                  <PriorityRankingPage />
                </ModuleRoute>
              }
            />

            {/* Channels */}
            <Route path="channels/email" element={<EmailCampaignsPage />} />

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </ProtectedRoute>
      {user && (
        <AiChatWidget
          apiBase="/api/v1/ai"
          role={user.role ?? "viewer"}
          tenantName="Coritiba FBC"
          position="bottom-right"
        />
      )}
    </>
  );
}
