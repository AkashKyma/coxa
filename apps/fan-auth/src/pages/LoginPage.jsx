import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { authApi } from "../lib/api.js";
import { analytics } from "@coxa/analytics";

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL ?? "http://localhost:5176";

const BENEFITS = [
  { icon: "🎟", text: "Priority ticket access" },
  { icon: "🏆", text: "Fan score & tier rewards" },
  { icon: "🛍", text: "Exclusive shop discounts" },
  { icon: "🤝", text: "Sócio Coxa membership" },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      const token = res.data.token;
      localStorage.setItem("coxa_fan_token", token);
      analytics.track("fan_login", { method: "email", app: "fan-auth" });
      if (res.data.fanProfileId) {
        analytics.identify(res.data.fanProfileId, { email });
      }
      window.location.replace(`${DASHBOARD_URL}?token=${encodeURIComponent(token)}`);
    } catch (err) {
      analytics.track("fan_login_failed", { method: "email", error: err.message, app: "fan-auth" });
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="fan-auth-layout">
      {/* Hero */}
      <div className="fan-auth-hero">
        <div className="fan-auth-hero__logo">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <circle cx="14" cy="14" r="10" fill="white" opacity="0.9" />
            <text x="14" y="19" textAnchor="middle" fontSize="13" fontWeight="800" fill="#4D8B31">C</text>
          </svg>
        </div>
        <p className="fan-auth-hero__title">Coxa ID</p>
        <p className="fan-auth-hero__tagline">Your passport to everything Coxa</p>
      </div>

      {/* Benefits strip */}
      <div className="coxa-id-benefits">
        {BENEFITS.map((b) => (
          <div key={b.text} className="coxa-id-benefit">
            <span className="coxa-id-benefit__icon">{b.icon}</span>
            <span className="coxa-id-benefit__text">{b.text}</span>
          </div>
        ))}
      </div>

      <div className="auth-card coxa-id-card">
        <h1>Welcome back</h1>
        <p>Sign in with your Coxa ID to access your benefits.</p>

        {error && <div className="auth-alert auth-alert--error">{error}</div>}

        <form onSubmit={handleSubmit} noValidate className="onboarding-form">
          <div className="field-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="joao@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

            <div className="field-group">
            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <input
                type="checkbox"
                id="toggle-password"
                className="password-toggle-check"
                checked={showPassword}
                onChange={() => setShowPassword((v) => !v)}
              />
              <label
                htmlFor="toggle-password"
                className="password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </label>
            </div>
          </div>

          <button type="submit" className="btn-next btn-next--full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in with Coxa ID"}
          </button>
        </form>

        <div className="auth-footer" style={{ marginTop: "1.25rem" }}>
          New fan? <Link to="/signup">Create your Coxa ID</Link>
          {" · "}
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        <p className="auth-hint">Demo: fan@coxa.local · Demo1234!</p>
      </div>
    </div>
  );
}
