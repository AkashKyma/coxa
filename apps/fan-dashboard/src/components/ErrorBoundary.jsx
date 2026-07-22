import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: "60vh", textAlign: "center", padding: "2rem",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#1e293b" }}>
          Something went wrong
        </h2>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: "#64748b", maxWidth: 400 }}>
          An unexpected error occurred. Please refresh the page. If the problem persists, contact support.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: "10px 24px", borderRadius: 8, border: "none",
            background: "#6366f1", color: "#fff", fontWeight: 600,
            cursor: "pointer", fontSize: 14,
          }}
        >
          Reload page
        </button>
      </div>
    );
  }
}
