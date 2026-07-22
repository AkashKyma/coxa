import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { FanDataProvider } from "./context/FanDataContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import DashboardLayout from "./layouts/DashboardLayout.jsx";
import HomePage from "./pages/HomePage.jsx";
import TicketsPage from "./pages/TicketsPage.jsx";
import WalletPage from "./pages/WalletPage.jsx";
import RewardsPage from "./pages/RewardsPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import ShopPage from "./pages/ShopPage.jsx";
import ShopOrdersPage from "./pages/ShopOrdersPage.jsx";
import MembershipPage from "./pages/MembershipPage.jsx";
import ReferralsPage from "./pages/ReferralsPage.jsx";
import UnsubscribePage from "./pages/UnsubscribePage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import ProfileEditPage from "./pages/ProfileEditPage.jsx";
import SettingsPageFan from "./pages/SettingsPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import ConsentPage from "./pages/ConsentPage.jsx";
import CommunityPage from "./pages/CommunityPage.jsx";
import LeaderboardPage from "./pages/LeaderboardPage.jsx";
import MatchCheckinPage from "./pages/MatchCheckinPage.jsx";
import MatchesPage from "./pages/MatchesPage.jsx";
import NewsPage from "./pages/NewsPage.jsx";
import PlayersPage from "./pages/PlayersPage.jsx";
import PredictionsPage from "./pages/PredictionsPage.jsx";
import PollsPage from "./pages/PollsPage.jsx";
import VideosPage from "./pages/VideosPage.jsx";
import VotesPage from "./pages/VotesPage.jsx";
import FriendsPage from "./pages/FriendsPage.jsx";
import SupportPage from "./pages/SupportPage.jsx";
import HelpPage from "./pages/HelpPage.jsx";
import FaqPage from "./pages/FaqPage.jsx";
import LanguagePage from "./pages/LanguagePage.jsx";
import { analytics } from "@coxa/analytics";

const PAGE_NAMES = {
  "/": "Fan Home",
  "/shop": "Shop",
  "/shop/orders": "My Orders",
  "/tickets": "My Tickets",
  "/wallet": "Wallet",
  "/rewards": "Rewards",
  "/profile": "Profile",
  "/membership": "Membership",
  "/membership/referrals": "Referrals",
  "/profile/edit": "Edit Profile",
  "/settings": "Settings",
  "/notifications": "Notifications",
  "/consent": "Privacy & Consent",
  "/privacy": "Privacy & Consent",
  "/community": "Comunidade",
  "/leaderboard": "Ranking",
  "/checkin": "Check-in no Estádio",
  "/matches": "Jogos",
  "/news": "Notícias",
  "/players": "Elenco",
  "/videos": "Vídeos",
  "/predictions": "Palpites",
  "/polls": "Enquetes",
  "/votes": "Votações",
  "/friends": "Amigos",
  "/support": "Suporte",
  "/help": "Ajuda",
  "/faq": "FAQ",
  "/language": "Idioma",
};

/**
 * Runs inside AuthProvider — fires page views and identifies the fan
 * once their profile is loaded.
 */
function FanAnalytics() {
  const { user, fanProfile } = useAuth();
  const location = useLocation();
  const identifiedRef = useRef(false);

  // Identify fan as soon as their profile is available
  useEffect(() => {
    if (!fanProfile || identifiedRef.current) return;
    identifiedRef.current = true;
    analytics.identify(fanProfile._id ?? fanProfile.id ?? fanProfile.fanId, {
      email: user?.email,
      name: user?.fullName ?? fanProfile.fullName,
      memberId: fanProfile.memberId,
      fanScore: fanProfile.fanScore,
      loyaltyTier: fanProfile.loyaltyTier,
      app: "fan-dashboard",
    });
  }, [fanProfile, user]);

  // Page view on every route change
  useEffect(() => {
    const name = PAGE_NAMES[location.pathname] ?? location.pathname;
    analytics.page(name, { path: location.pathname, app: "fan-dashboard" });
  }, [location.pathname]);

  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        {/* Public route — no auth needed */}
        <Routes>
          <Route path="unsubscribe" element={<UnsubscribePage />} />
        </Routes>
        <ProtectedRoute>
        <FanDataProvider>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route index element={<HomePage />} />
              <Route path="shop" element={<ShopPage />} />
              <Route path="shop/orders" element={<ShopOrdersPage />} />
              <Route path="tickets" element={<TicketsPage />} />
              <Route path="wallet" element={<WalletPage />} />
              <Route path="rewards" element={<RewardsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="membership" element={<MembershipPage />} />
              <Route path="membership/referrals" element={<ReferralsPage />} />
              <Route path="profile/edit" element={<ProfileEditPage />} />
              <Route path="settings" element={<SettingsPageFan />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="consent" element={<ConsentPage />} />
              <Route path="privacy" element={<ConsentPage />} />
              <Route path="community" element={<CommunityPage />} />
              <Route path="leaderboard" element={<LeaderboardPage />} />
              <Route path="checkin" element={<MatchCheckinPage />} />
              <Route path="matches" element={<MatchesPage />} />
              <Route path="news" element={<NewsPage />} />
              <Route path="news/:id" element={<NewsPage />} />
              <Route path="players" element={<PlayersPage />} />
              <Route path="videos" element={<VideosPage />} />
              <Route path="predictions" element={<PredictionsPage />} />
              <Route path="polls" element={<PollsPage />} />
              <Route path="votes" element={<VotesPage />} />
              <Route path="friends" element={<FriendsPage />} />
              <Route path="support" element={<SupportPage />} />
              <Route path="help" element={<HelpPage />} />
              <Route path="faq" element={<FaqPage />} />
              <Route path="language" element={<LanguagePage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
          <FanAnalytics />
        </FanDataProvider>
      </ProtectedRoute>
      </AuthProvider>
    </ErrorBoundary>
  );
}
