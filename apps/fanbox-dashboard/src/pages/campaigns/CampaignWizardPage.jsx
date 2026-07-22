import { useEffect, useState } from "react";
import { fanboxApi } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";

const MOCK_TEMPLATES = [
  { _id: "mock-1", name: "Welcome", subject: "Welcome to the club!", previewColor: "#dbeafe" },
  { _id: "mock-2", name: "Special Offer", subject: "Exclusive offer just for you", previewColor: "#dcfce7" },
  { _id: "mock-3", name: "Monthly Newsletter", subject: "What's new this month", previewColor: "#ede9fe" },
];

const STEPS = ["Template", "Audience", "Schedule", "Preview", "Create"];

function StepIndicator({ current }) {
  return (
    <div style={{ display: "flex", gap: 0, marginBottom: 28, alignItems: "center" }}>
      {STEPS.map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center",
              fontSize: 12, fontWeight: 700, flexShrink: 0,
              background: i < current ? "#16a34a" : i === current ? "var(--coxa-primary)" : "var(--coxa-border)",
              color: i <= current ? "#fff" : "var(--coxa-text-muted)",
            }}>
              {i < current ? "✓" : i + 1}
            </div>
            <span style={{ fontSize: 12, fontWeight: i === current ? 700 : 500, color: i === current ? "var(--coxa-text)" : "var(--coxa-text-muted)", whiteSpace: "nowrap" }}>{s}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div style={{ flex: 1, height: 2, background: i < current ? "#16a34a" : "var(--coxa-border)", margin: "0 10px" }} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function CampaignWizardPage() {
  const [step, setStep] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [filters, setFilters] = useState([]);
  const [form, setForm] = useState({
    name: "",
    type: "email",
    subject: "",
    templateId: "",
    savedFilterId: "",
    scheduleMode: "now",
    scheduledAt: "",
  });
  const [successModal, setSuccessModal] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      fanboxApi.listTemplates().catch(() => ({ data: [] })),
      fanboxApi.listFilters().catch(() => ({ data: [] })),
    ]).then(([tRes, fRes]) => {
      const tData = tRes.data ?? [];
      setTemplates(tData.length ? tData : MOCK_TEMPLATES);
      setFilters(fRes.data ?? []);
    });
  }, []);

  function upd(patch) { setForm((p) => ({ ...p, ...patch })); }
  const selectedTemplate = templates.find((t) => t._id === form.templateId) ?? templates[0];
  const selectedFilter = filters.find((f) => f._id === form.savedFilterId);
  const audienceLabel = selectedFilter ? selectedFilter.name : "Todos os fãs";
  const audienceCount = selectedFilter?.lastRunCount ?? null;
  const sendTime = form.scheduleMode === "now" ? "Send now" : (form.scheduledAt ? new Date(form.scheduledAt).toLocaleString("pt-BR") : "—");

  async function createCampaign() {
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        name: form.name || selectedTemplate?.name || "Nova Campanha",
        type: form.type,
        subject: form.subject || selectedTemplate?.subject || "",
        templateId: form.templateId || undefined,
        savedFilterId: form.savedFilterId || undefined,
        scheduledAt: form.scheduleMode === "scheduled" && form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
        status: form.scheduleMode === "now" ? "draft" : "scheduled",
        abTest: { enabled: false },
      };
      const res = await fanboxApi.createCampaign(payload);
      const createdId = res.data?._id ?? res.data?.id ?? res._id ?? "—";
      setSuccessModal(createdId);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <PageHeader module="Campaigns" title="Campaign Wizard" description="Create a campaign step by step with template, audience, and schedule." />

      {successModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--coxa-surface)", borderRadius: 14, padding: "32px 36px", maxWidth: 420, width: "100%", textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.2rem" }}>Campaign created successfully!</h2>
            <p style={{ color: "var(--coxa-text-muted)", fontSize: 13, marginBottom: 20 }}>ID: <code>{successModal}</code></p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button type="button" className="btn btn--ghost" onClick={() => setSuccessModal(null)}>Close</button>
              <a href="/campaigns" className="btn btn--primary" style={{ textDecoration: "none", padding: "0.5rem 1rem", borderRadius: "var(--coxa-radius-sm)", fontWeight: 600 }}>View Campaigns</a>
            </div>
          </div>
        </div>
      )}

      <section className="panel">
        <StepIndicator current={step} />

        {/* ── Step 0: Template ─────────────────────────────────────────── */}
        {step === 0 && (
          <div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Campaign name</label>
              <input className="input" value={form.name} onChange={(e) => upd({ name: e.target.value })} placeholder="E.g. Welcome New Members" />
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>Channel</label>
              <select className="input" value={form.type} onChange={(e) => upd({ type: e.target.value })}>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="push">Push</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 4 }}>
              <label>Choose a template</label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
              {templates.map((t) => (
                <div key={t._id} onClick={() => upd({ templateId: t._id, subject: t.subject || form.subject })}
                  style={{ border: `2px solid ${form.templateId === t._id ? "var(--coxa-primary)" : "var(--coxa-border)"}`,
                    borderRadius: 10, overflow: "hidden", cursor: "pointer", transition: "border-color 0.15s" }}>
                  <div style={{ height: 80, background: t.previewColor ?? "#f1f5f9", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, color: "#475569" }}>
                    {t.name}
                  </div>
                  <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--coxa-text-muted)" }}>{t.subject || "—"}</div>
                </div>
              ))}
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>Email subject</label>
              <input className="input" value={form.subject} onChange={(e) => upd({ subject: e.target.value })} placeholder="Subject…" />
            </div>
          </div>
        )}

        {/* ── Step 1: Audiência ────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label>Audience (segment)</label>
              <select className="input" value={form.savedFilterId} onChange={(e) => upd({ savedFilterId: e.target.value })}>
                <option value="">All fans</option>
                {filters.map((f) => (
                  <option key={f._id} value={f._id}>{f.name}{f.lastRunCount ? ` (~${f.lastRunCount.toLocaleString()})` : ""}</option>
                ))}
              </select>
            </div>
            <div style={{ padding: "14px 16px", background: "var(--coxa-surface-raised)", borderRadius: 10, border: "1.5px solid var(--coxa-border)", fontSize: 13 }}>
              Selected audience: <strong>{audienceLabel}</strong>
              {audienceCount != null && <span style={{ color: "var(--coxa-text-muted)", marginLeft: 8 }}>(~{audienceCount.toLocaleString()} fans)</span>}
            </div>
          </div>
        )}

        {/* ── Step 2: Agendamento ──────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              {["now", "scheduled"].map((m) => (
                <button key={m} type="button" onClick={() => upd({ scheduleMode: m })}
                  style={{ padding: "10px 22px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    background: form.scheduleMode === m ? "var(--coxa-primary)" : "var(--coxa-surface-raised)",
                    color: form.scheduleMode === m ? "#fff" : "var(--coxa-text-muted)",
                    border: `1.5px solid ${form.scheduleMode === m ? "var(--coxa-primary)" : "var(--coxa-border)"}` }}>
                  {m === "now" ? "🚀 Send now" : "📅 Schedule for"}
                </button>
              ))}
            </div>
            {form.scheduleMode === "scheduled" && (
              <div className="form-group">
                <label>Date and time</label>
                <input type="datetime-local" className="input" value={form.scheduledAt}
                  onChange={(e) => upd({ scheduledAt: e.target.value })} style={{ maxWidth: 280 }} />
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Prévia ───────────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <h3 style={{ marginBottom: 16, fontSize: "0.95rem" }}>Campaign summary</h3>
            <div style={{ display: "grid", gap: 12 }}>
              {[
                ["Nome", form.name || selectedTemplate?.name || "—"],
                ["Canal", form.type],
                ["Template", selectedTemplate?.name ?? "—"],
                ["Assunto", form.subject || selectedTemplate?.subject || "—"],
                ["Audience", audienceLabel + (audienceCount ? ` (~${audienceCount.toLocaleString()} fans)` : "")],
                ["Send", sendTime],
              ].map(([lbl, val]) => (
                <div key={lbl} style={{ display: "flex", gap: 12, padding: "10px 14px", background: "var(--coxa-surface-raised)", borderRadius: 8, border: "1px solid var(--coxa-border)" }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: "var(--coxa-text-muted)", width: 90, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{lbl}</span>
                  <span style={{ fontSize: 13, color: "var(--coxa-text)" }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 4: Criar ────────────────────────────────────────────── */}
        {step === 4 && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📣</div>
            <p style={{ fontSize: 14, color: "var(--coxa-text-muted)", marginBottom: 20 }}>
              All set. Click <strong>Create Campaign</strong> to finish.
            </p>
            <button type="button" className="btn btn--primary" onClick={createCampaign} disabled={submitting}
              style={{ fontSize: 14, padding: "10px 28px" }}>
              {submitting ? "Creating…" : "Create Campaign"}
            </button>
            {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28 }}>
          <button type="button" className="btn btn--ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            ← Back
          </button>
          {step < STEPS.length - 1 && (
            <button type="button" className="btn btn--primary" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              Next →
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
