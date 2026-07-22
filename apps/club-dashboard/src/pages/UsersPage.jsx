import { useEffect, useState, useCallback } from "react";
import { UserPlus, Pencil, Trash2, X, Check, ChevronDown } from "lucide-react";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { ROLE_REGISTRY, ROLE_CATEGORIES } from "../lib/roleRegistry.js";

/* ─── Role badge color map ─────────────────────────── */
const CATEGORY_COLOR = {
  administration: "badge--blue",
  security:       "badge--red",
  finance:        "badge--green",
  support:        "badge--yellow",
  data:           "badge--purple",
  marketing:      "badge--pink",
  ticketing:      "badge--orange",
  operations:     "badge--orange",
  commerce:       "badge--teal",
  marketplace:    "badge--teal",
  platform:       "badge--gray",
  fan:            "badge--gray",
};

function RoleBadge({ roleCode }) {
  const def = ROLE_REGISTRY[roleCode];
  if (!def) return <span className="badge">{roleCode}</span>;
  const cls = CATEGORY_COLOR[def.category] ?? "badge--gray";
  return <span className={`badge ${cls}`}>{def.name}</span>;
}

/* ─── Invite / Edit slide-over panel ──────────────────── */
function MemberPanel({ clubId, member, onClose, onSaved }) {
  const isEdit = !!member;
  const [form, setForm] = useState({
    fullName: member?.user?.fullName ?? "",
    email:    member?.user?.email ?? "",
    role:     member?.role ?? "",
    jobTitle: member?.user?.jobTitle ?? "",
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filtered = categoryFilter === "all"
    ? Object.values(ROLE_REGISTRY).filter((r) => r.code !== "fan_member")
    : Object.values(ROLE_REGISTRY).filter((r) => r.category === categoryFilter && r.code !== "fan_member");

  function selectRole(roleCode) {
    setForm((prev) => ({ ...prev, role: roleCode }));
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.role) {
      setError("Please select a role.");
      return;
    }
    if (!isEdit && form.password && form.password.length < 8) {
      setError("Temporary password must be at least 8 characters, or leave blank to auto-generate.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await api.updateMemberRole(clubId, member.membershipId, form.role);
      } else {
        await api.inviteClubMember(clubId, {
          fullName: form.fullName,
          email:    form.email,
          role:     form.role,
          jobTitle: form.jobTitle || undefined,
          password: form.password || undefined,
        });
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="slide-over-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="slide-over">
        <header className="slide-over__header">
          <h2>{isEdit ? "Edit role" : "Invite staff member"}</h2>
          <button className="btn btn--icon" onClick={onClose}><X size={18} /></button>
        </header>

        <form className="slide-over__body" onSubmit={handleSubmit}>
          {!isEdit && (
            <>
              <div className="form-group">
                <label>Full name *</label>
                <input
                  className="input"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Jane Smith"
                  required
                />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jane@club.com"
                  required
                />
              </div>
              <div className="form-group">
                <label>Job title</label>
                <input
                  className="input"
                  value={form.jobTitle}
                  onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                  placeholder="Gate Supervisor"
                />
              </div>
              <div className="form-group">
                <label>Temporary password</label>
                <input
                  className="input"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Leave blank to auto-generate"
                />
                <span className="form-hint">Min 8 chars, or leave blank to auto-generate.</span>
              </div>
            </>
          )}

          {isEdit && (
            <div className="form-group">
              <label>User</label>
              <p className="text-muted" style={{ margin: 0 }}>
                {member.user?.fullName} &nbsp;·&nbsp; {member.user?.email}
              </p>
            </div>
          )}

          {/* Role picker with category tabs */}
          <div className="form-group">
            <label>Role *</label>
            {form.role && (
              <p className="form-hint" style={{ marginBottom: "0.5rem" }}>
                Selected: <strong>{ROLE_REGISTRY[form.role]?.name ?? form.role}</strong>
              </p>
            )}
            <div className="role-picker">
              <div className="role-picker__tabs">
                <button
                  type="button"
                  className={`role-tab ${categoryFilter === "all" ? "role-tab--active" : ""}`}
                  onClick={() => setCategoryFilter("all")}
                >
                  All
                </button>
                {ROLE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    className={`role-tab ${categoryFilter === cat.key ? "role-tab--active" : ""}`}
                    onClick={() => setCategoryFilter(cat.key)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <div className="role-picker__grid">
                {filtered.map((r) => (
                  <button
                    key={r.code}
                    type="button"
                    className={`role-option ${form.role === r.code ? "role-option--selected" : ""}`}
                    onClick={() => selectRole(r.code)}
                  >
                    <span className="role-option__name">{r.name}</span>
                    <span className="role-option__desc">{r.description}</span>
                    <span className={`badge ${CATEGORY_COLOR[r.category] ?? "badge--gray"} role-option__cat`}>
                      {r.category}
                    </span>
                    {form.role === r.code && (
                      <Check size={14} className="role-option__check" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && <div className="alert alert--error">{error}</div>}

          <div className="slide-over__footer">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Update role" : "Send invite"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

/* ─── Main page ───────────────────────────────────────── */
export default function UsersPage() {
  const { club, clubId } = useAuth();
  const [members, setMembers]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [panel, setPanel]         = useState(null); // null | "invite" | member object
  const [removing, setRemoving]   = useState(null);
  const [searchQ, setSearchQ]     = useState("");
  const [catFilter, setCatFilter] = useState("all");

  const load = useCallback(() => {
    if (!clubId) return;
    setLoading(true);
    setError(null);
    api.listClubMembers(clubId)
      .then((res) => setMembers(res.data.members ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [clubId]);

  useEffect(() => { load(); }, [load]);

  async function handleRemove(m) {
    if (!confirm(`Remove ${m.user?.fullName ?? m.user?.email} from the club?`)) return;
    setRemoving(m.membershipId);
    try {
      await api.removeClubMember(clubId, m.membershipId);
      setMembers((prev) => prev.filter((x) => x.membershipId !== m.membershipId));
    } catch (err) {
      setError(err.message);
    } finally {
      setRemoving(null);
    }
  }

  /* ── filter ── */
  const visible = members.filter((m) => {
    const q = searchQ.toLowerCase();
    const nameMatch = (m.user?.fullName ?? "").toLowerCase().includes(q);
    const emailMatch = (m.user?.email ?? "").toLowerCase().includes(q);
    const roleMatch = (m.role ?? "").toLowerCase().includes(q);
    const textOk = !q || nameMatch || emailMatch || roleMatch;

    const roleDef = ROLE_REGISTRY[m.role];
    const catOk = catFilter === "all" || roleDef?.category === catFilter;
    return textOk && catOk;
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Staff &amp; Users</h1>
          <p className="text-muted">
            {members.length} member{members.length !== 1 ? "s" : ""} in{" "}
            <strong>{club?.name ?? "this club"}</strong>
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => setPanel("invite")}>
          <UserPlus size={16} /> Invite member
        </button>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {/* Toolbar */}
      <div className="toolbar" style={{ marginBottom: "var(--space-4)" }}>
        <input
          className="input toolbar__search"
          placeholder="Search by name, email or role…"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
        />
        <div className="toolbar__tabs">
          <button
            className={`role-tab ${catFilter === "all" ? "role-tab--active" : ""}`}
            onClick={() => setCatFilter("all")}
          >
            All
          </button>
          {ROLE_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              className={`role-tab ${catFilter === cat.key ? "role-tab--active" : ""}`}
              onClick={() => setCatFilter(cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-muted">Loading members…</p>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <p>No members found{searchQ ? " for your search." : "."}</p>
        </div>
      ) : (
        <div className="users-table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Category</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((m) => {
                const roleDef = ROLE_REGISTRY[m.role];
                return (
                  <tr key={m.membershipId}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar">
                          {(m.user?.fullName ?? "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <strong>{m.user?.fullName ?? "—"}</strong>
                          {m.user?.jobTitle && (
                            <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                              {m.user.jobTitle}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-muted">{m.user?.email ?? "—"}</td>
                    <td><RoleBadge roleCode={m.role} /></td>
                    <td>
                      {roleDef ? (
                        <span className="text-muted" style={{ textTransform: "capitalize" }}>
                          {roleDef.category}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="text-muted">
                      {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : "—"}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="btn btn--icon btn--ghost"
                          title="Edit role"
                          onClick={() => setPanel(m)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="btn btn--icon btn--ghost btn--danger"
                          title="Remove"
                          disabled={removing === m.membershipId}
                          onClick={() => handleRemove(m)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {panel && (
        <MemberPanel
          clubId={clubId}
          member={panel === "invite" ? null : panel}
          onClose={() => setPanel(null)}
          onSaved={() => { setPanel(null); load(); }}
        />
      )}
    </div>
  );
}
