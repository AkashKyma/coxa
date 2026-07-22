import { useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "http://localhost:5175";

export default function ProtectedRoute({ children }) {
  const { loading, user } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      window.location.replace(AUTH_URL);
    }
  }, [loading, user]);

  if (loading) {
    return (
      <div className="shell">
        <p className="loading-text">Loading…</p>
      </div>
    );
  }

  if (!user) return null;

  return children;
}
