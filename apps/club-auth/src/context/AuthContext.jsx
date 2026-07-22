import { createContext, useContext, useState, useEffect } from "react";
import { authApi } from "../lib/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [club, setClub] = useState(null);
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("coxa_token");
    if (!token) { setLoading(false); return; }

    authApi.me()
      .then((res) => {
        setUser(res.data.user);
        if (res.data.memberships?.length) {
          setClub(res.data.memberships[0].club);
          setMembership(res.data.memberships[0]);
        }
      })
      .catch(() => localStorage.removeItem("coxa_token"))
      .finally(() => setLoading(false));
  }, []);

  function saveSession({ user, club, membership, token }) {
    localStorage.setItem("coxa_token", token);
    setUser(user);
    setClub(club);
    setMembership(membership ?? null);
  }

  function logout() {
    localStorage.removeItem("coxa_token");
    setUser(null);
    setClub(null);
    setMembership(null);
  }

  return (
    <AuthContext.Provider value={{ user, club, membership, loading, saveSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
