import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("cashier@coxa.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pos-login-shell">
      <div className="auth-card">
        <div className="brand brand--pill">Coxa POS</div>
        <h1>Staff sign in</h1>
        <p>Retail sales and box office ticketing.</p>

        {error && <div className="auth-alert">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="email">Work email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="auth-hint">Demo: cashier@coxa.local · CoxaDemo123!</p>
      </div>
    </div>
  );
}
