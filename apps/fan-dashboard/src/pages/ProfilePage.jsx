import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { profileApi, loyaltyApi } from "../lib/api.js";

export default function ProfilePage() {
  const { user, fanProfile } = useAuth();
  const [loyalty, setLoyalty] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [error, setError] = useState(null);

  // Form state
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    postalCode: "",
    country: "Brasil",
    gender: "",
    birthDate: "",
  });

  useEffect(() => {
    loyaltyApi.me().then((res) => setLoyalty(res.data)).catch((err) => setError(err.message));
  }, []);

  const profile = fanProfile ?? loyalty?.fan;

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setForm({
        fullName: profile.fullName ?? "",
        phone: profile.phone ?? "",
        street: profile.address?.street ?? "",
        city: profile.address?.city ?? "",
        state: profile.address?.state ?? "",
        postalCode: profile.address?.postalCode ?? "",
        country: profile.address?.country ?? "Brasil",
        gender: profile.gender ?? "",
        birthDate: profile.birthDate ? profile.birthDate.substring(0, 10) : "",
      });
    }
  }, [profile]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await profileApi.update({
        fullName: form.fullName.trim(),
        phone: form.phone.trim() || undefined,
        gender: form.gender || undefined,
        birthDate: form.birthDate || undefined,
        address: {
          street: form.street.trim() || undefined,
          city: form.city.trim() || undefined,
          state: form.state.trim() || undefined,
          postalCode: form.postalCode.trim() || undefined,
          country: form.country.trim() || undefined,
        },
      });
      setEditing(false);
      setSaveMsg("Profile updated successfully.");
      setTimeout(() => setSaveMsg(""), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%", padding: "8px 10px", border: "1.5px solid #e5e7eb",
    borderRadius: 8, fontSize: 14, background: editing ? "#fff" : "#f8fafc",
    outline: "none", transition: "border-color 0.15s",
  };

  return (
    <div>
      <header className="page-header">
        <h1>Profile &amp; preferences</h1>
        <p>Your Coxa ID account details and contact information.</p>
      </header>

      {error && <div className="alert error" style={{ marginBottom: 16 }}>{error}</div>}
      {saveMsg && <div className="alert success" style={{ marginBottom: 16 }}>{saveMsg}</div>}

      <form onSubmit={handleSave}>
        <section className="panel" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 className="panel__title" style={{ margin: 0 }}>Account</h2>
            {!editing ? (
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => setEditing(true)}>
                Edit profile
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Full name</label>
              <input name="fullName" value={form.fullName} onChange={handleChange} disabled={!editing} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Email</label>
              <input value={profile?.email ?? user?.email ?? "—"} disabled style={{ ...inputStyle, background: "#f1f5f9", color: "#94a3b8" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} disabled={!editing} style={inputStyle} placeholder="+55 41 99999-0000" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Date of birth</label>
              <input name="birthDate" type="date" value={form.birthDate} onChange={handleChange} disabled={!editing} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Gender</label>
              <select name="gender" value={form.gender} onChange={handleChange} disabled={!editing} style={inputStyle}>
                <option value="">— Prefer not to say —</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Fan ID</label>
              <input value={profile?.fanId ?? "—"} disabled style={{ ...inputStyle, background: "#f1f5f9", color: "#94a3b8", fontFamily: "monospace", fontSize: 12 }} />
            </div>
          </div>
        </section>

        <section className="panel" style={{ marginBottom: 20 }}>
          <h2 className="panel__title" style={{ marginBottom: 16 }}>Address</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Street</label>
              <input name="street" value={form.street} onChange={handleChange} disabled={!editing} style={inputStyle} placeholder="Rua das Palmeiras, 123" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>City</label>
              <input name="city" value={form.city} onChange={handleChange} disabled={!editing} style={inputStyle} placeholder="Curitiba" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>State</label>
              <input name="state" value={form.state} onChange={handleChange} disabled={!editing} style={inputStyle} placeholder="PR" maxLength={2} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Postal code (CEP)</label>
              <input name="postalCode" value={form.postalCode} onChange={handleChange} disabled={!editing} style={inputStyle} placeholder="80000-000" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Country</label>
              <input name="country" value={form.country} onChange={handleChange} disabled={!editing} style={inputStyle} />
            </div>
          </div>
        </section>

        <section className="panel">
          <h2 className="panel__title" style={{ marginBottom: 8 }}>Consent &amp; preferences</h2>
          <p className="panel__desc" style={{ fontSize: 13, color: "#6b7280" }}>
            Marketing and channel preferences (email, push, WhatsApp) will be shown here when the consent module is enabled for your club.
          </p>
        </section>
      </form>
    </div>
  );
}
