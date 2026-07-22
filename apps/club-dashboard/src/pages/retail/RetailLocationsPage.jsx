import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";
import FormSidebar from "../../components/FormSidebar.jsx";
import DataTable from "@coxa/ui/DataTable";

export default function RetailLocationsPage() {
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", type: "store" });

  function load() {
    api
      .listLocations()
      .then((res) => setLocations(res.data))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.createLocation(form);
      setForm({ code: "", name: "", type: "store" });
      setSidebarOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const columns = [
    { key: "code", header: "Code", render: (loc) => <code>{loc.code}</code> },
    { key: "name", header: "Name" },
    { key: "type", header: "Type", render: (loc) => <span className="badge">{loc.type}</span> },
    { key: "status", header: "Status" },
  ];

  return (
    <div>
      <PageHeader
        title="Locations"
        description="Warehouses, stadium stores, and online fan shop channel."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setSidebarOpen(true)}>
            Add location
          </button>
        }
      />

      {error && <div className="alert error">{error}</div>}

      <DataTable columns={columns} data={locations} emptyMessage="No locations yet" />

      <FormSidebar
        open={sidebarOpen}
        title="Add location"
        description="Register a warehouse, store or online channel."
        onClose={() => setSidebarOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setSidebarOpen(false)}>Cancel</button>
            <button type="submit" form="location-form" className="btn btn--primary">Create location</button>
          </>
        }
      >
        <form id="location-form" onSubmit={handleSubmit} className="form-grid">
          <div className="form-field">
            <label className="field-label">Code</label>
            <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="stadium_store" />
          </div>
          <div className="form-field">
            <label className="field-label">Display name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Stadium Store" />
          </div>
          <div className="form-field form-field--full">
            <label className="field-label">Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="warehouse">Warehouse</option>
              <option value="store">Store</option>
              <option value="online">Online (fan shop)</option>
            </select>
          </div>
        </form>
      </FormSidebar>
    </div>
  );
}
