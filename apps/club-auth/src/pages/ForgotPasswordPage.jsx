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
    } catch {
      // Always succeed — prevent email enumeration
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="brand brand--pill">Coxa Club</div>
        <h1>Reset password</h1>

        {submitted ? (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <p style={{ marginBottom: 16 }}>
              If an account exists for <strong>{email}</strong>, a reset link has been sent.
              The link expires in 1 hour.
            </p>
            <Link to="/" style={{ color: "#6366f1", fontSize: 14 }}>← Back to sign in</Link>
          </div>
        ) : (
          <>
            <p>Enter your work email and we'll send you a secure reset link.</p>
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
              <button type="submit" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <div className="auth-footer">
              <Link to="/">← Back to sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
