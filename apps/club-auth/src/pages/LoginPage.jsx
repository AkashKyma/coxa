import { useState } from "react";
import { authApi } from "../lib/api.js";

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL ?? "http://localhost:5174";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Email and password are required"); return; }
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      // Save token in club-auth's localStorage first,
      // then hand it off to club-dashboard via query param
      // (localStorage is origin-scoped: :5173 ≠ :5174).
      const token = res.data.token;
      localStorage.setItem("coxa_token", token);
      window.location.replace(`${DASHBOARD_URL}?token=${encodeURIComponent(token)}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="brand brand--pill">Coxa Club</div>
        <h1>Staff sign in</h1>
        <p>Club admin, operations and staff access.</p>

        {error && <div className="auth-alert">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="email">Work email</label>
          <input
            id="email"
            type="email"
            placeholder="jane@club.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="auth-footer">
          Contact your club administrator to get access.
          {" · "}
          <a href="/forgot-password" style={{ color: "#6366f1" }}>Forgot password?</a>
        </div>
      </div>
    </div>
  );
}
