import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

const BASE = import.meta.env.VITE_API_URL ?? "";
const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "http://localhost:5175";
const TOKEN_KEY = "coxa_fan_token";

async function apiFetch(path, token, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "x-tenant-id": import.meta.env.VITE_TENANT_ID ?? "coxa-club-001",
      ...(token && { Authorization: `Bearer ${token}` }),
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
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    params.delete("token");
    const clean = params.toString()
      ? `${window.location.pathname}?${params}`
      : window.location.pathname;
    window.history.replaceState({}, "", clean);
  }
  return localStorage.getItem(TOKEN_KEY);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [fanProfile, setFanProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = consumeTokenFromUrl();
    if (!t) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await apiFetch("/api/v1/auth/fan/me", t);
        setUser(res.data.user);
        setFanProfile(res.data.fanProfile);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = AUTH_URL;
  }

  const value = {
    user,
    fanProfile,
    loading,
    logout,
    get token() {
      return localStorage.getItem(TOKEN_KEY);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
