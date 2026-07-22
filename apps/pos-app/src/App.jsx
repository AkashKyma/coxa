import { useState } from "react";
import { useAuth } from "./context/AuthContext.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RetailPos from "./pages/RetailPos.jsx";
import FnbPos from "./pages/FnbPos.jsx";
import BoxOffice from "./pages/BoxOffice.jsx";

const MODES = [
  { id: "retail", label: "Retail" },
  { id: "fnb", label: "F&B" },
  { id: "boxoffice", label: "Box office" },
];

export default function App() {
  const { user, club, loading, logout } = useAuth();
  const [mode, setMode] = useState("retail");

  if (loading) {
    return (
      <div className="pos-shell">
        <p className="loading-text">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="pos-shell">
      <header className="pos-header">
        <div className="pos-header__brand">
          <div className="brand">Coxa POS</div>
          <span className="pos-header__meta">{club?.name ?? "Club"} · Register</span>
        </div>

        <div className="pos-mode-switch" role="tablist" aria-label="POS mode">
          {MODES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              className={mode === id ? "active" : ""}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="pos-header__user">
          <span className="topbar-user__name">{user.fullName}</span>
          <button type="button" className="sign-out" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="main">
        {mode === "retail" && <RetailPos />}
        {mode === "fnb" && <FnbPos />}
        {mode === "boxoffice" && <BoxOffice />}
      </main>
    </div>
  );
}
