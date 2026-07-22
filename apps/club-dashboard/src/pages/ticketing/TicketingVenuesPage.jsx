import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";
import FormSidebar from "../../components/FormSidebar.jsx";
import DataTable from "@coxa/ui/DataTable";

const SECTION_TYPES = [
  { value: "general", label: "General" },
  { value: "vip", label: "VIP" },
  { value: "hospitality", label: "Hospitality" },
  { value: "standing", label: "Standing" },
  { value: "accessibility", label: "Accessibility" },
];

const emptySection = () => ({
  id: "",
  code: "",
  name: "",
  capacity: "",
  sectionType: "general",
});

const emptyVenue = () => ({
  code: "",
  name: "",
  address: "",
  city: "",
  sections: [emptySection()],
});

function venueToForm(venue) {
  return {
    code: venue.code ?? "",
    name: venue.name ?? "",
    address: venue.address ?? "",
    city: venue.city ?? "",
    sections: (venue.sections?.length ? venue.sections : [emptySection()]).map((s) => ({
      id: s.id ?? "",
      code: s.code ?? "",
      name: s.name ?? "",
      capacity: String(s.capacity ?? ""),
      sectionType: s.sectionType ?? "general",
    })),
  };
}

export default function TicketingVenuesPage() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyVenue());
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  function load() {
    setLoading(true);
    api
      .listVenues({ includeInactive: "true" })
      .then((res) => setVenues(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyVenue());
    setSidebarOpen(true);
  }

  function openEdit(venue) {
    setEditingId(venue.id);
    setForm(venueToForm(venue));
    setSidebarOpen(true);
  }

  function closeSidebar() {
    setSidebarOpen(false);
    setEditingId(null);
    setForm(emptyVenue());
  }

  function updateSection(index, patch) {
    setForm((f) => ({
      ...f,
      sections: f.sections.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  }

  function addSection() {
    setForm((f) => ({ ...f, sections: [...f.sections, emptySection()] }));
  }

  function removeSection(index) {
    setForm((f) => ({
      ...f,
      sections: f.sections.length > 1 ? f.sections.filter((_, i) => i !== index) : f.sections,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        sections: form.sections
          .filter((s) => s.code.trim() && s.name.trim())
          .map((s) => ({
            ...(s.id ? { id: s.id } : {}),
            code: s.code.trim(),
            name: s.name.trim(),
            capacity: Number(s.capacity),
            sectionType: s.sectionType,
          })),
      };

      if (editingId) {
        await api.updateVenue(editingId, payload);
      } else {
        await api.createVenue(payload);
      }
      closeSidebar();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(venue) {
    const msg = venue.status === "inactive"
      ? `Permanently remove "${venue.name}"?`
      : `Delete "${venue.name}"? Venues linked to events will be deactivated instead.`;
    if (!window.confirm(msg)) return;
    setError(null);
    try {
      await api.deleteVenue(venue.id);
      if (expandedId === venue.id) setExpandedId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const venueColumns = [
    { key: "name", header: "Venue", render: (v) => (
      <>
        <div className="cell-main">{v.name}</div>
        <div className="cell-sub"><code>{v.code}</code></div>
      </>
    )},
    { key: "city", header: "City", render: (v) => v.city || "—" },
    {
      key: "capacity",
      header: "Capacity",
      render: (v) => v.totalCapacity?.toLocaleString("pt-BR") ?? "0",
    },
    {
      key: "sections",
      header: "Sections",
      render: (v) => v.sections?.length ?? 0,
    },
    {
      key: "status",
      header: "Status",
      render: (v) => (
        <span className={`badge ${v.status === "active" ? "badge--success" : "badge--muted"}`}>
          {v.status}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (v) => (
        <div className="table-actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}>
            {expandedId === v.id ? "Hide" : "Sections"}
          </button>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => openEdit(v)}>
            Edit
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => handleDelete(v)}>
            Delete
          </button>
        </div>
      ),
    },
  ];

  const sectionColumns = [
    { key: "code", header: "Code", render: (s) => <code>{s.code}</code> },
    { key: "name", header: "Section" },
    { key: "type", header: "Type", render: (s) => s.sectionType },
    {
      key: "capacity",
      header: "Capacity",
      render: (s) => s.capacity?.toLocaleString("pt-BR"),
    },
  ];

  const expandedVenue = venues.find((v) => v.id === expandedId);

  return (
    <div>
      <PageHeader
        title="Venues"
        description="Stadium configuration — sections, capacity and gate mapping."
        actions={
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            Add venue
          </button>
        }
      />

      {error && <div className="alert error">{error}</div>}

      <DataTable
        columns={venueColumns}
        data={venues}
        loading={loading}
        emptyMessage="No venues yet. Add one or run seed."
      />

      {expandedVenue && (
        <section className="panel-card" style={{ marginTop: "1.5rem" }}>
          <div className="panel-card__head">
            <h3>{expandedVenue.name} — sections</h3>
            <p>{expandedVenue.address ? `${expandedVenue.address}, ` : ""}{expandedVenue.city}</p>
          </div>
          <div className="panel-card__body panel-card__body--flush">
            <DataTable
              columns={sectionColumns}
              data={expandedVenue.sections ?? []}
              rowKey={(s) => s.id ?? s.code}
              pagination={false}
              className="coxa-data-table-wrapper--flush"
              emptyMessage="No sections configured."
            />
          </div>
        </section>
      )}

      <FormSidebar
        open={sidebarOpen}
        title={editingId ? "Edit venue" : "Add venue"}
        description="Configure stadium details and seating sections."
        onClose={closeSidebar}
        width="36rem"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={closeSidebar}>Cancel</button>
            <button type="submit" form="venue-form" className="btn btn--primary" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Create venue"}
            </button>
          </>
        }
      >
        <form id="venue-form" onSubmit={handleSubmit} className="form-grid">
          <div className="form-field">
            <label className="field-label">Code</label>
            <input
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="coxa_arena"
            />
          </div>
          <div className="form-field">
            <label className="field-label">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Coxa Arena"
            />
          </div>
          <div className="form-field form-field--full">
            <label className="field-label">Address</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Rua …"
            />
          </div>
          <div className="form-field form-field--full">
            <label className="field-label">City</label>
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Curitiba"
            />
          </div>

          <div className="form-field form-field--full">
            <div className="form-section-head">
              <label className="field-label">Sections</label>
              <button type="button" className="btn btn--ghost btn--sm" onClick={addSection}>
                + Add section
              </button>
            </div>
            <div className="section-editor">
              {form.sections.map((section, index) => (
                <div key={index} className="section-editor__row">
                  <input
                    required
                    value={section.code}
                    onChange={(e) => updateSection(index, { code: e.target.value })}
                    placeholder="Code"
                  />
                  <input
                    required
                    value={section.name}
                    onChange={(e) => updateSection(index, { name: e.target.value })}
                    placeholder="Section name"
                  />
                  <input
                    required
                    type="number"
                    min="0"
                    value={section.capacity}
                    onChange={(e) => updateSection(index, { capacity: e.target.value })}
                    placeholder="Cap."
                  />
                  <select
                    value={section.sectionType}
                    onChange={(e) => updateSection(index, { sectionType: e.target.value })}
                  >
                    {SECTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => removeSection(index)}
                    aria-label="Remove section"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </form>
      </FormSidebar>
    </div>
  );
}
