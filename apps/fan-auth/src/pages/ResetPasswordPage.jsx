import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { authApi } from "../lib/api.js";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) setError("Missing or invalid reset token. Please request a new link.");
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password || password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    setError("");
    setLoading(true);
    try {
      await authApi.resetPassword({ token, password });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fan-auth-layout">
      <div className="fan-auth-hero">
        <div className="fan-auth-hero__logo">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <circle cx="14" cy="14" r="10" fill="white" opacity="0.9" />
            <text x="14" y="19" textAnchor="middle" fontSize="13" fontWeight="800" fill="#4D8B31">C</text>
          </svg>
        </div>
        <p className="fan-auth-hero__title">Coxa ID</p>
        <p className="fan-auth-hero__tagline">Set a new password</p>
      </div>

      <div className="auth-card coxa-id-card">
        {done ? (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <h2 style={{ marginBottom: 8 }}>Password updated!</h2>
            <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
              Your password has been changed. You can now sign in with your new password.
            </p>
            <Link to="/" className="btn-next btn-next--full" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
              Sign in
            </Link>
          </div>
        ) : (
          <>
            <h1>Set new password</h1>
            <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
              Choose a strong password of at least 8 characters.
            </p>

            {error && <div className="auth-alert auth-alert--error">{error}</div>}

            <form onSubmit={handleSubmit} noValidate className="onboarding-form">
              <div className="field-group">
                <label htmlFor="password">New password</label>
                <div className="password-field">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <input type="checkbox" id="toggle-pw" className="password-toggle-check" checked={showPassword} onChange={() => setShowPassword((v) => !v)} />
                  <label htmlFor="toggle-pw" className="password-toggle" aria-label="Toggle visibility">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </label>
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="confirm">Confirm new password</label>
                <div className="password-field">
                  <input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn-next btn-next--full" disabled={loading || !token}>
                {loading ? "Saving…" : "Update password"}
              </button>
            </form>

            <div className="auth-footer" style={{ marginTop: "1.25rem" }}>
              <Link to="/forgot-password">Request a new link</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
