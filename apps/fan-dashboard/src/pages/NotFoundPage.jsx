import { useNavigate } from "react-router-dom";

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "60vh", textAlign: "center", padding: "2rem",
    }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>404</div>
      <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, color: "#1e293b" }}>Page not found</h2>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "#64748b" }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <button
        type="button"
        onClick={() => navigate("/")}
        style={{
          padding: "10px 24px", borderRadius: 8, border: "none",
          background: "#6366f1", color: "#fff", fontWeight: 600,
          cursor: "pointer", fontSize: 14,
        }}
      >
        Back to home
      </button>
    </div>
  );
}
