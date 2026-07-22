import { useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";

const AUTH_URL = import.meta.env.VITE_AUTH_URL ?? "http://localhost:5173";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // Redirect in an effect, never during render
  useEffect(() => {
    if (!loading && !user) {
      window.location.replace(AUTH_URL);
    }
  }, [loading, user]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <span style={{ color: "var(--coxa-text-muted)", fontFamily: "var(--coxa-font)" }}>
          Verifying session…
        </span>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <span style={{ color: "var(--coxa-text-muted)", fontFamily: "var(--coxa-font)" }}>
          Redirecting to sign in…
        </span>
      </div>
    );
  }

  return children;
}
