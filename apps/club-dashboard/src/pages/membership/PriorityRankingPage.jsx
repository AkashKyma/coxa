import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";
import DataTable from "@coxa/ui/DataTable";

const TIER_COLORS = {
  bronze: "#cd7f32",
  silver: "#adb5bd",
  gold: "#f4b942",
  platinum: "#9bc3e0",
  diamond: "#7ee8fa",
};

export default function PriorityRankingPage() {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .listMatchEvents({ upcoming: true })
      .then((res) => {
        const evts = res.data ?? [];
        setEvents(evts);
        if (evts.length > 0) setSelectedEventId(evts[0].id ?? evts[0]._id);
      })
      .catch((err) => setError(err.message))
      .finally(() => setEventsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;
    setLoading(true);
    setError(null);
    api
      .getPriorityRanking(selectedEventId)
      .then((res) => setRanking(res.data ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedEventId]);

  const columns = [
    {
      key: "rank",
      header: "#",
      render: (r) => (
        <strong style={{ fontSize: "1.1rem" }}>#{r.rank}</strong>
      ),
    },
    {
      key: "name",
      header: "Member",
      render: (r) => (
        <div>
          <div>{r.fullName ?? "—"}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--coxa-text-muted)" }}>{r.email}</div>
        </div>
      ),
    },
    { key: "memberNumber", header: "Member #", render: (r) => r.memberNumber ?? "—" },
    { key: "planCode", header: "Plan", render: (r) => r.planCode ?? "—" },
    {
      key: "tier",
      header: "Tier",
      render: (r) => (
        <span
          className="status-pill"
          style={{ background: TIER_COLORS[r.tier] ?? "#adb5bd", color: "#000" }}
        >
          {r.tier ?? "—"}
        </span>
      ),
    },
    {
      key: "score",
      header: "Fan score",
      render: (r) => (
        <strong>{(r.totalScore ?? 0).toLocaleString()}</strong>
      ),
    },
    {
      key: "bestWindow",
      header: "Best window",
      render: (r) => r.bestWindowName ?? "—",
    },
    {
      key: "joinDate",
      header: "Member since",
      render: (r) =>
        r.joinDate ? new Date(r.joinDate).toLocaleDateString("pt-BR") : "—",
    },
  ];

  return (
    <div>
      <PageHeader
        module="Membership"
        title="Priority ranking"
        description="Fans ranked by fan score for a specific match — determines check-in window access order."
      />

      {error && <div className="alert error">{error}</div>}

      <div style={{ display: "flex", gap: "1rem", margin: "1rem 0", alignItems: "center" }}>
        <label style={{ fontWeight: 600, whiteSpace: "nowrap" }}>Match event:</label>
        {eventsLoading ? (
          <span>Loading events…</span>
        ) : (
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            style={{ flex: 1, maxWidth: "400px" }}
          >
            <option value="">— Select a match —</option>
            {events.map((ev) => (
              <option key={ev.id ?? ev._id} value={ev.id ?? ev._id}>
                {ev.title} — {ev.startsAt ? new Date(ev.startsAt).toLocaleDateString("pt-BR") : ""}
              </option>
            ))}
          </select>
        )}
        <span style={{ color: "var(--coxa-text-muted)", fontSize: "0.85rem" }}>
          {ranking.length > 0 ? `${ranking.length} members qualify` : ""}
        </span>
      </div>

      <div className="panel-card">
        <div className="panel-card__body">
          {loading ? (
            <p style={{ padding: "1rem" }}>Loading priority list…</p>
          ) : !selectedEventId ? (
            <div className="empty-state">
              <p className="empty-state__title">Select a match to see rankings</p>
            </div>
          ) : ranking.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__title">No members qualify for this match</p>
              <p className="empty-state__desc">Members need an active membership and fan score to appear here.</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={ranking}
              rowKey="fanProfileId"
              pagination={ranking.length > 20}
            />
          )}
        </div>
      </div>
    </div>
  );
}
