import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "../lib/api.js";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) setError("Invalid or missing reset token. Please request a new link.");
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
    <div className="auth-layout">
      <div className="auth-card">
        <div className="brand brand--pill">Coxa Club</div>
        <h1>Set new password</h1>

        {done ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ marginBottom: 16 }}>Password updated successfully.</p>
            <Link to="/" style={{ color: "#6366f1", fontSize: 14 }}>Sign in with new password →</Link>
          </div>
        ) : (
          <>
            {error && <div className="auth-alert">{error}</div>}
            <form onSubmit={handleSubmit} noValidate>
              <label htmlFor="password">New password</label>
              <input
                id="password"
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <label htmlFor="confirm">Confirm password</label>
              <input
                id="confirm"
                type="password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <button type="submit" disabled={loading || !token}>
                {loading ? "Saving…" : "Update password"}
              </button>
            </form>
            <div className="auth-footer">
              <Link to="/forgot-password">Request a new link</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
