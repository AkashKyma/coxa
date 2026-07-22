import { useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import ReportTable from "../../components/ReportTable.jsx";
import { fanboxApi } from "../../lib/api.js";

export default function ImportPage() {
  const [importType, setImportType] = useState("cadastros");
  const [filename, setFilename] = useState("import.csv");
  const [csvText, setCsvText] = useState("fanId,fullName,email\nfan-001,Example Fan,fan@example.com");
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function loadJobs() {
    fanboxApi
      .listImportJobs()
      .then((res) => setJobs(res.data ?? []))
      .catch((err) => setError(err.message));
  }

  async function submitImport() {
    setMessage("");
    setError("");
    try {
      const res = await fanboxApi.importCsv(importType, { csvText, filename });
      setMessage(`Import job created: ${res.data?._id ?? "unknown id"}`);
      loadJobs();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <PageHeader module="Control Panel" title="CSV Import" description="Upload raw CSV text for cadastros or leads, then track jobs." />
      <section className="panel">
        <h2>New import</h2>
        <div className="toolbar">
          <select className="input" value={importType} onChange={(e) => setImportType(e.target.value)}>
            <option value="cadastros">cadastros</option>
            <option value="leads">leads</option>
          </select>
          <input className="input" value={filename} onChange={(e) => setFilename(e.target.value)} placeholder="filename.csv" />
        </div>
        <textarea className="input textarea" rows={8} value={csvText} onChange={(e) => setCsvText(e.target.value)} />
        <div className="toolbar">
          <button type="button" className="btn btn--primary" onClick={submitImport}>Run import</button>
          <button type="button" className="btn btn--ghost" onClick={loadJobs}>Refresh job history</button>
        </div>
        {message && <p className="text-muted">{message}</p>}
      </section>

      <ReportTable
        title="Import jobs"
        rows={jobs}
        columns={[
          { key: "_id", label: "Job ID" },
          { key: "type", label: "Type" },
          { key: "status", label: "Status" },
          { key: "rowsOk", label: "Rows OK" },
          { key: "rowsFailed", label: "Rows failed" },
          { key: "createdAt", label: "Created at" },
        ]}
        csvFilename="import-jobs.csv"
      />

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
