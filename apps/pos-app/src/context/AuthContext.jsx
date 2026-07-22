import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

const BASE = import.meta.env.VITE_API_URL ?? "";
const TOKEN_KEY = "coxa_pos_token";
const CLUB_KEY = "coxa_pos_club_id";

async function apiFetch(path, token, clubId, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "x-tenant-id": import.meta.env.VITE_TENANT_ID ?? "coxa-club-001",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(clubId && { "X-Club-Id": clubId }),
      ...options.headers,
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
  return data;
}

function consumeTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const clubId = params.get("clubId");
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    if (clubId) localStorage.setItem(CLUB_KEY, clubId);
    params.delete("token");
    params.delete("clubId");
    const clean = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
    window.history.replaceState({}, "", clean);
  }
  return {
    token: localStorage.getItem(TOKEN_KEY),
    clubId: localStorage.getItem(CLUB_KEY),
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { token, clubId } = consumeTokenFromUrl();
    if (!token) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await apiFetch("/api/v1/auth/me", token, clubId);
        setUser(res.data.user);
        const activeClub = res.data.memberships?.[0]?.club;
        setClub(activeClub ?? null);
        if (activeClub && !clubId) {
          localStorage.setItem(CLUB_KEY, activeClub.id ?? activeClub._id);
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(CLUB_KEY);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(email, password) {
    const res = await fetch(`${BASE}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? "Login failed");

    const token = data.data.token;
    const clubId = data.data.club?.id ?? data.data.club?._id;
    localStorage.setItem(TOKEN_KEY, token);
    if (clubId) localStorage.setItem(CLUB_KEY, clubId);
    setUser(data.data.user);
    setClub(data.data.club);
    return data.data;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CLUB_KEY);
    setUser(null);
    setClub(null);
  }

  const value = {
    user,
    club,
    loading,
    login,
    logout,
    get token() {
      return localStorage.getItem(TOKEN_KEY);
    },
    get clubId() {
      return localStorage.getItem(CLUB_KEY);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
