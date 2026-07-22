import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { Plus, X, Star } from "lucide-react";

const DEFAULT_TIERS = [
  {
    name: "Bronze",
    minPoints: 0,
    maxPoints: 999,
    color: "#CD7F32",
    benefits: ["5% store discount", "Early access to tickets"],
  },
  {
    name: "Silver",
    minPoints: 1000,
    maxPoints: 4999,
    color: "#C0C0C0",
    benefits: ["10% store discount", "Free shipping", "Exclusive newsletter"],
  },
  {
    name: "Gold",
    minPoints: 5000,
    maxPoints: null,
    color: "#F2C438",
    benefits: [
      "15% store discount",
      "VIP access",
      "Invitation to exclusive events",
      "Premium digital membership card",
    ],
  },
];

function Toast({ msg, type = "success", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: type === "error" ? "#dc2626" : "#0C6B3A",
      color: "#fff", padding: "12px 20px", borderRadius: 8,
      boxShadow: "0 4px 16px rgba(0,0,0,0.2)", fontSize: 13, fontWeight: 500,
      maxWidth: 360,
    }}>
      {msg}
    </div>
  );
}

function TierCard({ tier, onChange }) {
  const fieldStyle = {
    width: "100%", padding: "7px 10px",
    border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13,
    boxSizing: "border-box", outline: "none", background: "#fff",
  };

  function set(field, value) {
    onChange({ ...tier, [field]: value });
  }

  function addBenefit() {
    onChange({ ...tier, benefits: [...tier.benefits, ""] });
  }

  function setBenefit(idx, val) {
    const benefits = [...tier.benefits];
    benefits[idx] = val;
    onChange({ ...tier, benefits });
  }

  function removeBenefit(idx) {
    onChange({ ...tier, benefits: tier.benefits.filter((_, i) => i !== idx) });
  }

  return (
    <div style={{
      background: "#fff",
      borderRadius: 12,
      boxShadow: "0 1px 8px rgba(0,0,0,0.07)",
      border: "1px solid #f1f5f9",
      borderTop: `4px solid ${tier.color}`,
      flex: "1 1 280px",
      minWidth: 260,
      maxWidth: 380,
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: tier.color, flexShrink: 0 }} />
          <input
            value={tier.name}
            onChange={(e) => set("name", e.target.value)}
            style={{ ...fieldStyle, fontWeight: 700, fontSize: 15, flex: 1 }}
            placeholder="Tier name"
          />
          <input
            type="color"
            value={tier.color}
            onChange={(e) => set("color", e.target.value)}
            style={{ width: 34, height: 34, border: "1.5px solid #e5e7eb", borderRadius: 6, cursor: "pointer", padding: 2, flexShrink: 0 }}
            title="Tier color"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Minimum Points</label>
            <input
              type="number"
              min={0}
              value={tier.minPoints ?? 0}
              onChange={(e) => set("minPoints", Number(e.target.value))}
              style={fieldStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Maximum Points</label>
            <input
              type="number"
              min={0}
              value={tier.maxPoints ?? ""}
              onChange={(e) => set("maxPoints", e.target.value === "" ? null : Number(e.target.value))}
              placeholder="No limit"
              style={fieldStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>Benefits</label>
          {tier.benefits.map((benefit, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <input
                value={benefit}
                onChange={(e) => setBenefit(idx, e.target.value)}
                style={{ ...fieldStyle, flex: 1 }}
                placeholder="Describe a benefit"
              />
              <button
                type="button"
                onClick={() => removeBenefit(idx)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2, flexShrink: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addBenefit}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "none", border: "1.5px dashed #d1d5db", borderRadius: 8,
              padding: "6px 12px", fontSize: 12, color: "#6b7280", cursor: "pointer",
              width: "100%", justifyContent: "center", marginTop: 4,
            }}
          >
            <Plus size={12} strokeWidth={2} />
            Add Benefit
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoyaltyTierConfigPage() {
  const [tiers, setTiers] = useState(DEFAULT_TIERS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api.getLoyaltyTiers()
      .then((res) => {
        if (res.data?.length > 0) setTiers(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleTierChange(idx, updated) {
    setTiers((ts) => ts.map((t, i) => (i === idx ? updated : t)));
  }

  function addTier() {
    setTiers((ts) => [
      ...ts,
      { name: "New Tier", minPoints: 0, maxPoints: null, color: "#6b7280", benefits: [] },
    ]);
  }

  function removeTier(idx) {
    if (tiers.length <= 1) return;
    setTiers((ts) => ts.filter((_, i) => i !== idx));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.saveLoyaltyTiers(tiers);
      setToast({ msg: "Configuration saved successfully", type: "success" });
    } catch (err) {
      setToast({ msg: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ padding: "2rem", color: "var(--coxa-text-muted, #64748b)" }}>Loading tier configuration…</div>;
  }

  return (
    <div className="page">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div className="page-header__left">
          <Star size={20} strokeWidth={2} />
          <div>
            <h1>Loyalty Tier Configuration</h1>
            <p className="page-header__sub">Define tiers, point ranges and benefits for the loyalty programme</p>
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={addTier}
          >
            <Plus size={13} style={{ marginRight: 5 }} />
            New tier
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Configuration"}
          </button>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, padding: "8px 0 24px" }}>
          {tiers.map((tier, idx) => (
            <div key={idx} style={{ position: "relative", flex: "1 1 280px", minWidth: 260, maxWidth: 380 }}>
              <TierCard tier={tier} onChange={(updated) => handleTierChange(idx, updated)} />
              {tiers.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTier(idx)}
                  title="Remove tier"
                  style={{
                    position: "absolute", top: 8, right: 8, background: "#fee2e2",
                    border: "none", borderRadius: 6, cursor: "pointer",
                    padding: "3px 7px", color: "#dc2626", fontSize: 11, fontWeight: 600,
                    zIndex: 1,
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </form>
    </div>
  );
}
