import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";
import DataTable from "@coxa/ui/DataTable";

const TIER_META = {
  bronze:   { color: "#cd7f32", label: "Bronze" },
  silver:   { color: "#adb5bd", label: "Silver" },
  gold:     { color: "#f4b942", label: "Gold" },
  platinum: { color: "#9bc3e0", label: "Platinum" },
  diamond:  { color: "#7ee8fa", label: "Diamond" },
};

const TIER_BY_LEVEL = { 1: "bronze", 2: "silver", 3: "gold", 4: "platinum", 5: "diamond" };

function TierPill({ tier, tierLevel }) {
  const key = tier ?? TIER_BY_LEVEL[tierLevel];
  const meta = TIER_META[key];
  if (!meta) return <span style={{ color: "var(--coxa-text-muted)" }}>—</span>;
  return (
    <span
      className="status-pill"
      style={{ background: meta.color, color: "#000", fontWeight: 600 }}
    >
      {meta.label}
    </span>
  );
}

export default function MembersPage() {
  const [members, setMembers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");

  function load() {
    setLoading(true);
    api
      .listMembers({
        search: search || undefined,
        status: statusFilter || undefined,
        planCode: planFilter || undefined,
      })
      .then((res) => {
        setMembers(res.data?.members ?? res.data ?? []);
        setTotal(res.data?.total ?? (res.data?.members ?? res.data ?? []).length);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    load();
  }

  const columns = [
    {
      key: "member",
      header: "Member",
      render: (m) => (
        <div>
          <Link to={`/membership/members/${m.id ?? m._id}`} className="table-link">
            {m.fanProfileId?.fullName ?? "—"}
          </Link>
          <div style={{ fontSize: "0.8rem", color: "var(--coxa-text-muted)" }}>
            {m.fanProfileId?.email ?? ""}
          </div>
        </div>
      ),
    },
    {
      key: "memberNumber",
      header: "Member #",
      render: (m) => m.memberNumber ?? "—",
    },
    {
      key: "plan",
      header: "Plan",
      render: (m) => m.planId?.name ?? m.planId?.planCode ?? m.planCode ?? "—",
    },
    {
      key: "tier",
      header: "Tier",
      render: (m) => (
        <TierPill
          tier={m.score?.tier}
          tierLevel={m.planId?.tierLevel}
        />
      ),
    },
    {
      key: "score",
      header: "Fan Score",
      render: (m) => (m.score?.totalScore ?? 0).toLocaleString(),
    },
    {
      key: "status",
      header: "Status",
      render: (m) => (
        <span
          className={`status-pill event-status--${
            m.status === "active"
              ? "sale"
              : m.status === "cancelled"
              ? "cancelled"
              : "draft"
          }`}
        >
          {m.status}
        </span>
      ),
    },
    {
      key: "joined",
      header: "Joined",
      render: (m) =>
        m.joinDate ? new Date(m.joinDate).toLocaleDateString("pt-BR") : "—",
    },
    {
      key: "renewal",
      header: "Renewal",
      render: (m) =>
        m.renewalDate ? new Date(m.renewalDate).toLocaleDateString("pt-BR") : "—",
    },
    {
      key: "actions",
      header: "",
      render: (m) => (
        <Link to={`/membership/members/${m.id ?? m._id}`} className="btn btn--ghost btn--sm">
          View
        </Link>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        module="Membership"
        title="Members"
        description={`${total.toLocaleString()} Sócio Coxa members`}
      />

      {error && <div className="alert error">{error}</div>}

      <form onSubmit={handleSearch} className="filters-row" style={{ display: "flex", gap: "0.75rem", margin: "1rem 0", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: "200px" }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: "140px" }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
        </select>
        <input
          type="text"
          placeholder="Plan code"
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          style={{ width: "140px" }}
        />
        <button type="submit" className="btn btn--primary">Search</button>
      </form>

      <div className="panel-card">
        <div className="panel-card__body">
          {loading ? (
            <p style={{ padding: "1rem" }}>Loading…</p>
          ) : (
            <DataTable
              columns={columns}
              data={members}
              rowKey="id"
              emptyMessage="No members found."
              pagination={members.length > 20}
            />
          )}
        </div>
      </div>
    </div>
  );
}
