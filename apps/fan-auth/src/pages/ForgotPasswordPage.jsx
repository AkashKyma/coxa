import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../lib/api.js";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) { setError("Email is required"); return; }
    setError("");
    setLoading(true);
    try {
      await authApi.forgotPassword({ email: email.trim().toLowerCase() });
      setSubmitted(true);
    } catch (err) {
      // Always show success to avoid email enumeration
      setSubmitted(true);
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
        <p className="fan-auth-hero__tagline">Reset your password</p>
      </div>

      <div className="auth-card coxa-id-card">
        {submitted ? (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
            <h2 style={{ marginBottom: 8 }}>Check your email</h2>
            <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
              If an account exists for <strong>{email}</strong>, a password reset link has been sent.
              The link expires in 1 hour.
            </p>
            <Link to="/" className="btn-next btn-next--full" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1>Forgot password?</h1>
            <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
              Enter your email and we'll send a secure link to reset your password.
            </p>

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
              <button type="submit" className="btn-next btn-next--full" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <div className="auth-footer" style={{ marginTop: "1.25rem" }}>
              <Link to="/">← Back to sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
