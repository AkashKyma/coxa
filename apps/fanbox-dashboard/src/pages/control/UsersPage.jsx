import { useEffect, useState, useCallback } from "react";
import { UserPlus, Pencil, Trash2, X } from "lucide-react";
import { staffApi } from "../../lib/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { usePermissions } from "../../lib/permissions.js";
import { FANBOX_ROLES, FANBOX_ROLE_MAP } from "../../lib/fanboxRoles.js";
import PageHeader from "../../components/PageHeader.jsx";

function StaffPanel({ member, onClose, onSaved }) {
  const isEdit = !!member;
  const [form, setForm] = useState({
    fullName: member?.user?.fullName ?? "",
    email: member?.user?.email ?? "",
    role: member?.role ?? "fanbox_viewer",
    jobTitle: member?.user?.jobTitle ?? "",
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await staffApi.update(member.staffId, { role: form.role });
      } else {
        await staffApi.create({
          fullName: form.fullName,
          email: form.email,
          role: form.role,
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
          <h2>{isEdit ? "Edit role" : "New FanBox user"}</h2>
          <button type="button" className="btn btn--icon" onClick={onClose}><X size={18} /></button>
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
                  required
                />
              </div>
              <div className="form-group">
                <label>Job title</label>
                <input
                  className="input"
                  value={form.jobTitle}
                  onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
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
              </div>
            </>
          )}

          {isEdit && (
            <div className="form-group">
              <label>User</label>
              <p className="text-muted" style={{ margin: 0 }}>
                {member.user?.fullName} · {member.user?.email}
              </p>
            </div>
          )}

          <div className="form-group">
            <label>FanBox role *</label>
            <select
              className="input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              required
            >
              {FANBOX_ROLES.map((r) => (
                <option key={r.code} value={r.code}>{r.name}</option>
              ))}
            </select>
            <span className="form-hint">
              {FANBOX_ROLE_MAP[form.role]?.description}
            </span>
          </div>

          {error && <div className="auth-alert">{error}</div>}

          <div className="slide-over__footer">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Update" : "Create user"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

export default function UsersPage() {
  const { club, clubId } = useAuth();
  const { canManageStaff } = usePermissions();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [panel, setPanel] = useState(null);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(() => {
    if (!clubId || !canManageStaff) return;
    setLoading(true);
    setError(null);
    staffApi.list()
      .then((res) => setStaff(res.data.staff ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [clubId, canManageStaff]);

  useEffect(() => { load(); }, [load]);

  async function handleRemove(m) {
    if (!confirm(`Remove FanBox access for ${m.user?.fullName ?? m.user?.email}?`)) return;
    setRemoving(m.staffId);
    try {
      await staffApi.remove(m.staffId);
      setStaff((prev) => prev.filter((x) => x.staffId !== m.staffId));
    } catch (err) {
      setError(err.message);
    } finally {
      setRemoving(null);
    }
  }

  if (!canManageStaff) {
    return (
      <div className="page">
        <PageHeader
          module="Control Panel"
          title="Account Management"
          description="Only FanBox administrators can manage users."
        />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        module="Control Panel"
        title="Account Management"
        description={`${staff.length} user(s) with FanBox access in ${club?.name ?? "club"}`}
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setPanel("invite")}>
            <UserPlus size={16} /> New user
          </button>
        }
      />

      {error && <div className="auth-alert">{error}</div>}

      {loading ? (
        <p className="text-muted">Loading users…</p>
      ) : staff.length === 0 ? (
        <div className="placeholder-card">No FanBox users yet.</div>
      ) : (
        <div className="panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Since</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((m) => (
                <tr key={m.staffId}>
                  <td>{m.user?.fullName ?? "-"}</td>
                  <td>{m.user?.email ?? "—"}</td>
                  <td>{FANBOX_ROLE_MAP[m.role]?.name ?? m.role}</td>
                  <td>{m.joinedAt ? new Date(m.joinedAt).toLocaleDateString("en-US") : "—"}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn btn--icon btn--ghost"
                        title="Edit role"
                        onClick={() => setPanel(m)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="btn btn--icon btn--ghost"
                        title="Remove access"
                        disabled={removing === m.staffId}
                        onClick={() => handleRemove(m)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {panel && (
        <StaffPanel
          member={panel === "invite" ? null : panel}
          onClose={() => setPanel(null)}
          onSaved={() => { setPanel(null); load(); }}
        />
      )}
    </div>
  );
}
