import { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext(null);

const BASE = import.meta.env.VITE_API_URL ?? "";
const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "http://localhost:5173";
const SELECTED_CLUB_KEY = "coxa_selected_club_id";

async function apiFetch(path, token, clubId, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(clubId && { "X-Club-Id": clubId }),
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * On first load: pick up ?token= handed off from club-auth,
 * persist to localStorage, and clean the URL.
 */
function consumeTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (token) {
    localStorage.setItem("coxa_token", token);
    params.delete("token");
    const clean = params.toString()
      ? `${window.location.pathname}?${params}`
      : window.location.pathname;
    window.history.replaceState({}, "", clean);
  }
  return localStorage.getItem("coxa_token");
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  /** All clubs the user belongs to: [{ club, role, moduleAccess, membershipId }] */
  const [allMemberships, setAllMemberships] = useState([]);
  /** The currently active club entry from allMemberships */
  const [activeMembership, setActiveMembership] = useState(null);
  const [loading, setLoading] = useState(true);

  const token = () => localStorage.getItem("coxa_token");

  /* Resolve which club to make active from the loaded memberships list */
  function resolveActive(memberships) {
    if (!memberships.length) return null;
    const savedId = localStorage.getItem(SELECTED_CLUB_KEY);
    const match = savedId && memberships.find((m) => m.club?.id === savedId || m.club?._id === savedId);
    return match ?? memberships[0];
  }

  /* Boot: consume token → load /me → load /clubs */
  useEffect(() => {
    const t = consumeTokenFromUrl();
    if (!t) { setLoading(false); return; }

    (async () => {
      try {
        const meRes = await apiFetch("/api/v1/auth/me", t, null);
        setUser(meRes.data.user);

        const clubsRes = await apiFetch("/api/v1/clubs", t, null);
        const memberships = clubsRes.data.clubs ?? [];
        setAllMemberships(memberships);

        const active = resolveActive(memberships);
        setActiveMembership(active);
        if (active) localStorage.setItem(SELECTED_CLUB_KEY, active.club?.id ?? active.club?._id);
      } catch {
        localStorage.removeItem("coxa_token");
        localStorage.removeItem(SELECTED_CLUB_KEY);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** Switch the active club — persists the choice and updates all downstream data */
  const switchClub = useCallback((clubId) => {
    const match = allMemberships.find((m) => m.club?.id === clubId || m.club?._id === clubId);
    if (!match) return;
    localStorage.setItem(SELECTED_CLUB_KEY, clubId);
    setActiveMembership(match);
  }, [allMemberships]);

  /** Add a freshly created club to the list and switch to it */
  const addClub = useCallback((newEntry) => {
    setAllMemberships((prev) => {
      const next = [...prev, newEntry];
      return next;
    });
    const clubId = newEntry.club?.id ?? newEntry.club?._id;
    localStorage.setItem(SELECTED_CLUB_KEY, clubId);
    setActiveMembership(newEntry);
  }, []);

  function logout() {
    localStorage.removeItem("coxa_token");
    localStorage.removeItem(SELECTED_CLUB_KEY);
    window.location.href = AUTH_URL;
  }

  const value = {
    user,
    club: activeMembership?.club ?? null,
    membership: activeMembership ? { role: activeMembership.role, moduleAccess: activeMembership.moduleAccess } : null,
    allMemberships,
    activeMembership,
    loading,
    switchClub,
    addClub,
    logout,
    /** Convenience: current token string */
    get token() { return token(); },
    /** Convenience: current active clubId string */
    get clubId() { return activeMembership?.club?.id ?? activeMembership?.club?._id ?? null; },
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
