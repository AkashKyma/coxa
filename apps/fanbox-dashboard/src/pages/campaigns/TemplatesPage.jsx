import { useEffect, useState } from "react";
import { fanboxApi } from "../../lib/api.js";
import PageHeader from "../../components/PageHeader.jsx";
import ReportTable from "../../components/ReportTable.jsx";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("<p>Template body</p>");
  const [error, setError] = useState("");

  function load() {
    fanboxApi
      .listTemplates()
      .then((res) => setTemplates(res.data ?? []))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function createTemplate() {
    await fanboxApi.createTemplate({ name, subject, bodyHtml });
    setName("");
    setSubject("");
    setBodyHtml("<p>Template body</p>");
    load();
  }

  async function deleteTemplate(id) {
    await fanboxApi.deleteTemplate(id);
    load();
  }

  return (
    <div className="page">
      <PageHeader module="Campaigns" title="Templates" description="Manage reusable campaign templates." />
      <section className="panel">
        <h2>Create template</h2>
        <div className="toolbar">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" />
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
        </div>
        <textarea className="input textarea" rows={6} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} />
        <button type="button" className="btn btn--primary" onClick={createTemplate}>Create template</button>
      </section>
      <ReportTable
        title="Template list"
        rows={templates}
        columns={[
          { key: "name", label: "Name" },
          { key: "subject", label: "Subject" },
          { key: "createdAt", label: "Created at" },
          {
            key: "actions",
            label: "Actions",
            sortable: false,
            render: (_, row) => (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => deleteTemplate(row._id)}>Delete</button>
            ),
          },
        ]}
        csvFilename="campaign-templates.csv"
      />
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
