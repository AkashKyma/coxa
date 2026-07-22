import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import FanboxLayout from "./layouts/FanboxLayout.jsx";
import { AiChatWidget } from "@coxa/ui-analytics";
import LoginPage from "./pages/LoginPage.jsx";
import { MODULE, usePermissions } from "./lib/permissions.js";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import OverviewPage from "./pages/OverviewPage.jsx";
import SingleFanViewPage from "./pages/fans/SingleFanViewPage.jsx";
import EngagementPage from "./pages/fans/EngagementPage.jsx";
import ProfilesPage from "./pages/fans/ProfilesPage.jsx";
import BusinessLayout from "./pages/business/BusinessLayout.jsx";
import BusinessReportPage from "./pages/business/BusinessReportPage.jsx";
import UsersPage from "./pages/control/UsersPage.jsx";
import FiltersPage from "./pages/intelligence/FiltersPage.jsx";
import InsightsPage from "./pages/intelligence/InsightsPage.jsx";
import WorkflowsPage from "./pages/intelligence/WorkflowsPage.jsx";
import ProjectsPage from "./pages/projects/ProjectsPage.jsx";
import CampaignsPage from "./pages/campaigns/CampaignsPage.jsx";
import CampaignWizardPage from "./pages/campaigns/CampaignWizardPage.jsx";
import TemplatesPage from "./pages/campaigns/TemplatesPage.jsx";
import ImportPage from "./pages/control/ImportPage.jsx";

function ModuleRoute({ module: moduleKey, children }) {
  const { can, isAdmin } = usePermissions();
  const { loading } = useAuth();

  if (loading) {
    return <div className="fanbox-loading">Loading module…</div>;
  }

  if (isAdmin || can(moduleKey)) return children;
  return <Navigate to="/" replace />;
}

const businessRoutes = [
  { path: "membership", title: "Membership", source: "membership" },
  { path: "tickets", title: "Tickets", source: "tickets" },
  { path: "access", title: "Access", source: "access" },
  { path: "stores", title: "Stores", source: "stores" },
  { path: "ecommerce", title: "E-Commerce", source: "ecommerce" },
  { path: "app", title: "Official App", source: "app" },
  { path: "ott", title: "Coxa Prime TV", source: "ott" },
  { path: "coxa-run", title: "Coxa Run", source: "coxa-run" },
  { path: "coxa-foods", title: "Coxa Foods", source: "coxa-foods" },
  { path: "manto", title: "Manto", source: "manto" },
];

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
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={(
            <ProtectedRoute>
              <FanboxLayout />
            </ProtectedRoute>
          )}
        >
          <Route index element={<OverviewPage />} />

          <Route
            path="fans/single"
            element={(
              <ModuleRoute module={MODULE.FANS}>
                <SingleFanViewPage />
              </ModuleRoute>
            )}
          />
          <Route
            path="fans/engagement"
            element={(
              <ModuleRoute module={MODULE.FANS}>
                <EngagementPage />
              </ModuleRoute>
            )}
          />
          <Route
            path="fans/profiles"
            element={(
              <ModuleRoute module={MODULE.FANS}>
                <ProfilesPage />
              </ModuleRoute>
            )}
          />

          <Route
            path="business"
            element={(
              <ModuleRoute module={MODULE.BUSINESS}>
                <BusinessLayout />
              </ModuleRoute>
            )}
          >
            <Route index element={<Navigate to="membership" replace />} />
            {businessRoutes.map((r) => (
              <Route key={r.path} path={r.path} element={<BusinessReportPage title={r.title} source={r.source} />} />
            ))}
          </Route>

          <Route path="projects/surveys" element={<ModuleRoute module={MODULE.PROJECTS}><ProjectsPage type="survey" /></ModuleRoute>} />
          <Route path="projects/votes" element={<ModuleRoute module={MODULE.PROJECTS}><ProjectsPage type="vote" /></ModuleRoute>} />
          <Route path="projects/raffles" element={<ModuleRoute module={MODULE.PROJECTS}><ProjectsPage type="raffle" /></ModuleRoute>} />
          <Route path="projects/contests" element={<ModuleRoute module={MODULE.PROJECTS}><ProjectsPage type="contest" /></ModuleRoute>} />
          <Route path="projects/nps" element={<ModuleRoute module={MODULE.PROJECTS}><ProjectsPage type="nps" /></ModuleRoute>} />

          <Route path="intelligence/filters" element={<ModuleRoute module={MODULE.INTELLIGENCE}><FiltersPage /></ModuleRoute>} />
          <Route path="intelligence/workflows" element={<ModuleRoute module={MODULE.INTELLIGENCE}><WorkflowsPage /></ModuleRoute>} />
          <Route path="intelligence/insights" element={<ModuleRoute module={MODULE.INTELLIGENCE}><InsightsPage /></ModuleRoute>} />

          <Route path="campaigns" element={<ModuleRoute module={MODULE.CAMPAIGNS}><CampaignsPage /></ModuleRoute>} />
          <Route path="campaigns/new" element={<ModuleRoute module={MODULE.CAMPAIGNS}><CampaignWizardPage /></ModuleRoute>} />
          <Route path="campaigns/templates" element={<ModuleRoute module={MODULE.CAMPAIGNS}><TemplatesPage /></ModuleRoute>} />

          <Route path="control/users" element={<ModuleRoute module={MODULE.CONTROL}><UsersPage /></ModuleRoute>} />
          <Route path="control/import" element={<ModuleRoute module={MODULE.CONTROL}><ImportPage /></ModuleRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      {user && (
        <AiChatWidget
          apiBase={`${import.meta.env.VITE_API_URL ?? ""}/api/v1/fanbox/ai`}
          authHeaders={{
            Authorization: `Bearer ${localStorage.getItem("fanbox_token") ?? ""}`,
            "X-Club-Id": localStorage.getItem("fanbox_selected_club_id") ?? "",
          }}
          role={user.role ?? "viewer"}
          tenantName="Coritiba FBC"
          position="bottom-right"
        />
      )}
    </>
  );
}