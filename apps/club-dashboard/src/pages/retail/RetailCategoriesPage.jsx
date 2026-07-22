import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";
import FormSidebar from "../../components/FormSidebar.jsx";
import DataTable from "@coxa/ui/DataTable";

export default function RetailCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "" });

  function load() {
    api
      .listCategories()
      .then((res) => setCategories(res.data))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const payload = {
      code: form.code.trim().toLowerCase(),
      name: form.name.trim(),
    };
    try {
      await api.createCategory(payload);
      setForm({ code: "", name: "" });
      setSidebarOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const columns = [
    { key: "code", header: "Code", render: (cat) => <code>{cat.code}</code> },
    { key: "name", header: "Name" },
    { key: "status", header: "Status" },
  ];

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Organize products by category code."
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setSidebarOpen(true)}>
            Add category
          </button>
        }
      />

      {error && <div className="alert error">{error}</div>}

      <DataTable
        columns={columns}
        data={categories}
        emptyMessage="No categories yet"
        pagination={categories.length > 10}
      />

      <FormSidebar
        open={sidebarOpen}
        title="Add category"
        description="Create a new product category."
        onClose={() => setSidebarOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setSidebarOpen(false)}>Cancel</button>
            <button type="submit" form="category-form" className="btn btn--primary">Create category</button>
          </>
        }
      >
        <form id="category-form" onSubmit={handleSubmit} className="form-grid">
          <div className="form-field">
            <label className="field-label">Code</label>
            <input
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="apparel"
            />
          </div>
          <div className="form-field">
            <label className="field-label">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Apparel"
            />
          </div>
        </form>
      </FormSidebar>
    </div>
  );
}
