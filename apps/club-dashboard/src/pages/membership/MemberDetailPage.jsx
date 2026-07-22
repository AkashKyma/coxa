import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, formatBrl } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";

const TIER_COLORS = {
  bronze: "#cd7f32",
  silver: "#adb5bd",
  gold: "#f4b942",
  platinum: "#9bc3e0",
  diamond: "#7ee8fa",
};

const SCORE_COMPONENTS = [
  { key: "attendanceScore", label: "Attendance", max: 30000 },
  { key: "tenureScore", label: "Tenure", max: 20000 },
  { key: "spendingScore", label: "Spending", max: 20000 },
  { key: "referralScore", label: "Referrals", max: 15000 },
  { key: "engagementScore", label: "Engagement", max: 10000 },
  { key: "donationScore", label: "Donations", max: 5000 },
];

function ScoreBar({ value, max }) {
  const pct = Math.min(100, Math.round(((value ?? 0) / max) * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <div style={{ flex: 1, height: "6px", background: "var(--coxa-surface-2)", borderRadius: "3px" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "var(--coxa-brand)",
            borderRadius: "3px",
            transition: "width 0.3s",
          }}
        />
      </div>
      <span style={{ fontSize: "0.8rem", color: "var(--coxa-text-muted)", minWidth: "50px", textAlign: "right" }}>
        {(value ?? 0).toLocaleString()}
      </span>
    </div>
  );
}

export default function MemberDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mlScores, setMlScores] = useState(null);

  useEffect(() => {
    api
      .getMember(id)
      .then((res) => {
        setData(res.data);
        // Load ML scores for the fan profile
        const fanProfileId = res.data?.fanProfile?._id ?? res.data?.fanProfile?.id;
        if (fanProfileId) {
          api.getMlScores(fanProfileId)
            .then((r) => setMlScores(r.data))
            .catch(() => {});
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ padding: "2rem" }}>Loading…</div>;
  if (error) return <div className="alert error">{error}</div>;
  if (!data) return null;

  const { membership, fanProfile, score, history } = data;
  const tier = score?.tier ?? "bronze";
  const tierColor = TIER_COLORS[tier] ?? "#adb5bd";

  return (
    <div>
      <PageHeader
        module="Membership"
        title={fanProfile?.fullName ?? "Member"}
        description={
          <Link to="/membership/members" style={{ color: "var(--coxa-text-muted)", fontSize: "0.85rem" }}>
            ← Back to members
          </Link>
        }
      />

      <div className="cards" style={{ marginTop: "1.5rem" }}>
        {/* Membership card */}
        <article className="card">
          <h3>Membership</h3>
          <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.5rem", fontSize: "0.9rem" }}>
            <div><strong>Plan:</strong> {membership?.planCode ?? "—"}</div>
            <div><strong>Member #:</strong> {membership?.memberNumber ?? "—"}</div>
            <div>
              <strong>Status:</strong>{" "}
              <span className={`status-pill event-status--${membership?.status === "active" ? "sale" : "draft"}`}>
                {membership?.status ?? "—"}
              </span>
            </div>
            <div><strong>Payment:</strong> {membership?.paymentFrequency ?? "—"}</div>
            <div>
              <strong>Joined:</strong>{" "}
              {membership?.joinDate ? new Date(membership.joinDate).toLocaleDateString("pt-BR") : "—"}
            </div>
            <div>
              <strong>Renewal:</strong>{" "}
              {membership?.renewalDate ? new Date(membership.renewalDate).toLocaleDateString("pt-BR") : "—"}
            </div>
          </div>
        </article>

        {/* Fan score card */}
        <article className="card">
          <h3>Fan score</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "0.75rem 0" }}>
            <span
              style={{
                background: tierColor,
                color: "#000",
                padding: "0.25rem 0.75rem",
                borderRadius: "999px",
                fontWeight: 700,
                textTransform: "capitalize",
              }}
            >
              {tier}
            </span>
            <span style={{ fontSize: "1.75rem", fontWeight: 800 }}>
              {(score?.totalScore ?? 0).toLocaleString()}
            </span>
          </div>
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {SCORE_COMPONENTS.map(({ key, label, max }) => (
              <div key={key}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "2px" }}>
                  <span>{label}</span>
                </div>
                <ScoreBar value={score?.[key] ?? 0} max={max} />
              </div>
            ))}
          </div>
        </article>

        {/* Fan profile card */}
        <article className="card">
          <h3>Fan profile</h3>
          <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.5rem", fontSize: "0.9rem" }}>
            <div><strong>Name:</strong> {fanProfile?.fullName ?? "—"}</div>
            <div><strong>Email:</strong> {fanProfile?.email ?? "—"}</div>
            <div><strong>Phone:</strong> {fanProfile?.phone ?? "—"}</div>
            <div><strong>Fan ID:</strong> {fanProfile?.fanId ?? "—"}</div>
            <div><strong>Member ID:</strong> {fanProfile?.memberId ?? "—"}</div>
            <div>
              <strong>Status:</strong>{" "}
              <span className={`status-pill event-status--${fanProfile?.status === "active" ? "sale" : "draft"}`}>
                {fanProfile?.status ?? "—"}
              </span>
            </div>
          </div>
        </article>

        {/* ML Intelligence card — Phase 3 */}
        {mlScores && (
          <article className="card" style={{ borderLeft: "3px solid #8b5cf6" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>🧠</span> ML Intelligence
            </h3>
            <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.75rem" }}>
              {[
                { label: "Churn Risk", value: mlScores.churnRiskScore, high: 0.7, mid: 0.4, colors: ["#dc2626", "#d97706", "#16a34a"] },
                { label: "Ticket Propensity", value: mlScores.ticketPropensity, high: 0.7, mid: 0.4, colors: ["#16a34a", "#d97706", "#dc2626"] },
                { label: "Retail Propensity", value: mlScores.retailPropensity, high: 0.7, mid: 0.4, colors: ["#16a34a", "#d97706", "#dc2626"] },
              ].map(({ label, value, high, mid, colors }) => {
                const pct = Math.round((value ?? 0) * 100);
                const color = pct >= high * 100 ? colors[0] : pct >= mid * 100 ? colors[1] : colors[2];
                return (
                  <div key={label}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "3px" }}>
                      <span>{label}</span>
                      <span style={{ fontWeight: 700, color }}>{pct}%</span>
                    </div>
                    <div style={{ height: 6, background: "var(--coxa-surface-2)", borderRadius: 3 }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.3s" }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", marginTop: "0.25rem" }}>
                <span><strong>Next Channel:</strong></span>
                <span style={{ fontWeight: 700, color: "#7c3aed", textTransform: "capitalize" }}>
                  {mlScores.nextBestChannel ?? "—"}
                </span>
              </div>
            </div>
          </article>
        )}
      </div>

      {/* Score history */}
      {history?.length > 0 && (
        <div className="panel-card" style={{ marginTop: "1.5rem" }}>
          <div className="panel-card__head">
            <h3>Score history</h3>
          </div>
          <div className="panel-card__body">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--coxa-border)" }}>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Date</th>
                  <th style={{ textAlign: "right", padding: "0.5rem" }}>Score</th>
                  <th style={{ textAlign: "right", padding: "0.5rem" }}>Delta</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Reason</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Tier change</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} style={{ borderBottom: "1px solid var(--coxa-border)" }}>
                    <td style={{ padding: "0.5rem" }}>
                      {new Date(h.calculatedAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "right" }}>{h.newScore?.toLocaleString()}</td>
                    <td style={{ padding: "0.5rem", textAlign: "right", color: h.delta >= 0 ? "var(--coxa-success)" : "var(--coxa-danger)" }}>
                      {h.delta >= 0 ? "+" : ""}{h.delta?.toLocaleString()}
                    </td>
                    <td style={{ padding: "0.5rem" }}>{h.reason ?? "—"}</td>
                    <td style={{ padding: "0.5rem" }}>
                      {h.previousTier !== h.newTier
                        ? `${h.previousTier} → ${h.newTier}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
