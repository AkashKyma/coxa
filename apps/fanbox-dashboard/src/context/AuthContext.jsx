import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi, TOKEN_KEY, SELECTED_CLUB_KEY } from "../lib/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [allMemberships, setAllMemberships] = useState([]);
  const [activeMembership, setActiveMembership] = useState(null);
  const [loading, setLoading] = useState(true);

  function resolveActive(memberships) {
    if (!memberships.length) return null;
    const savedId = localStorage.getItem(SELECTED_CLUB_KEY);
    const match = savedId && memberships.find((m) => {
      const id = m.club?.id ?? m.club?._id;
      return id === savedId;
    });
    return match ?? memberships[0];
  }

  const loadSession = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      setAllMemberships([]);
      setActiveMembership(null);
      return false;
    }

    const meRes = await authApi.me();
    const memberships = meRes.data.memberships ?? [];
    setUser(meRes.data.user);
    setAllMemberships(memberships);

    const active = resolveActive(memberships);
    setActiveMembership(active);
    if (active) {
      localStorage.setItem(SELECTED_CLUB_KEY, active.club?.id ?? active.club?._id);
    }
    return true;
  }, []);

  useEffect(() => {
    loadSession()
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(SELECTED_CLUB_KEY);
        setUser(null);
        setAllMemberships([]);
        setActiveMembership(null);
      })
      .finally(() => setLoading(false));
  }, [loadSession]);

  async function login(email, password) {
    const res = await authApi.login({ email, password });
    localStorage.setItem(TOKEN_KEY, res.data.token);

    const memberships = res.data.memberships ?? [];
    setUser(res.data.user);
    setAllMemberships(memberships);

    const active = resolveActive(memberships.length ? memberships : [{
      club: res.data.club,
      role: res.data.staff?.role,
      moduleAccess: res.data.staff?.moduleAccess,
      staffId: res.data.staff?.staffId,
    }]);
    setActiveMembership(active);
    if (active) {
      localStorage.setItem(SELECTED_CLUB_KEY, active.club?.id ?? active.club?._id);
    }
    return res.data;
  }

  const switchClub = useCallback((clubId) => {
    const match = allMemberships.find((m) => {
      const id = m.club?.id ?? m.club?._id;
      return id === clubId;
    });
    if (!match) return;
    localStorage.setItem(SELECTED_CLUB_KEY, clubId);
    setActiveMembership(match);
  }, [allMemberships]);

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SELECTED_CLUB_KEY);
    setUser(null);
    setAllMemberships([]);
    setActiveMembership(null);
    window.location.href = "/login";
  }

  const value = {
    user,
    club: activeMembership?.club ?? null,
    membership: activeMembership
      ? {
          role: activeMembership.role,
          moduleAccess: activeMembership.moduleAccess,
          staffId: activeMembership.staffId,
        }
      : null,
    allMemberships,
    activeMembership,
    loading,
    login,
    switchClub,
    logout,
    refreshSession: loadSession,
    get token() { return localStorage.getItem(TOKEN_KEY); },
    get clubId() { return activeMembership?.club?.id ?? activeMembership?.club?._id ?? null; },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
