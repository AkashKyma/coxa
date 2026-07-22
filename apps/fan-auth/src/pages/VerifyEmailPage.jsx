import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "../lib/api.js";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState("idle"); // idle | verifying | done | error
  const [error, setError] = useState("");

  async function handleVerify() {
    if (!token) { setError("Missing verification token."); return; }
    setStatus("verifying");
    try {
      await authApi.verifyEmail({ token });
      setStatus("done");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }

  // Auto-verify on mount if token present
  if (status === "idle" && token) { handleVerify(); }

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
      </div>

      <div className="auth-card coxa-id-card" style={{ textAlign: "center", padding: "2rem" }}>
        {(status === "idle" || status === "verifying") && (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📬</div>
            <h2>Verifying your email…</h2>
            <p style={{ color: "#6b7280", fontSize: 14 }}>Please wait a moment.</p>
          </>
        )}
        {status === "done" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <h2>Email verified!</h2>
            <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
              Your Coxa ID is now active. You can sign in and start enjoying your benefits.
            </p>
            <Link to="/" className="btn-next btn-next--full" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
              Sign in
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
            <h2>Verification failed</h2>
            <p style={{ color: "#dc2626", fontSize: 14, marginBottom: 20 }}>{error}</p>
            <p style={{ color: "#6b7280", fontSize: 13 }}>
              The link may have expired. <Link to="/signup">Create a new account</Link> or contact support.
            </p>
          </>
        )}
        {!token && (
          <>
            <h2>Check your inbox</h2>
            <p style={{ color: "#6b7280", fontSize: 14 }}>
              We sent a verification link to the email you registered. Click it to activate your Coxa ID.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
