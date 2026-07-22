import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";

const BASE_URL = import.meta.env.VITE_API_URL || "";

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const fanId = params.get("fan");
  const campaignId = params.get("campaign");
  const [status, setStatus] = useState("loading"); // loading | success | error | invalid

  useEffect(() => {
    if (!fanId) {
      setStatus("invalid");
      return;
    }
    const url = new URL(`${BASE_URL}/api/v1/fanprofile/unsubscribe`, window.location.origin);
    url.searchParams.set("fan", fanId);
    if (campaignId) url.searchParams.set("campaign", campaignId);

    fetch(url.toString(), { method: "POST" })
      .then((r) => {
        if (r.ok || r.status === 404) setStatus("success");
        else setStatus("error");
      })
      .catch(() => setStatus("error"));
  }, [fanId, campaignId]);

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#f8fafc",
      padding: "24px 16px",
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{
        maxWidth: 400,
        width: "100%",
        background: "#fff",
        borderRadius: 16,
        padding: "32px 24px",
        textAlign: "center",
        border: "1px solid #e5e7eb",
      }}>
        {status === "loading" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <p style={{ color: "#64748b", fontSize: 15 }}>Processing your request…</p>
          </>
        )}

        {status === "success" && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
              Unsubscribed
            </h1>
            <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              You've been removed from our mailing list. You won't receive marketing emails from us anymore.
            </p>
            <Link
              to="/"
              style={{
                display: "inline-block",
                background: "#e11d48",
                color: "#fff",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Back to Home
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
              Something went wrong
            </h1>
            <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>
              We couldn't process your unsubscribe request. Please try again later or contact support.
            </p>
          </>
        )}

        {status === "invalid" && (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
              Invalid link
            </h1>
            <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>
              This unsubscribe link is invalid or has expired.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
