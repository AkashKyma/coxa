import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import ReportTable from "../../components/ReportTable.jsx";
import { fanboxApi } from "../../lib/api.js";

export default function ProjectsPage({ type }) {
  const [projects, setProjects] = useState([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  function loadProjects() {
    fanboxApi
      .listProjects({ type })
      .then((res) => setProjects(res.data ?? []))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    loadProjects();
  }, [type]);

  async function createProject() {
    if (!title.trim()) return;
    await fanboxApi.createProject({ title, type, status: "draft" });
    setTitle("");
    loadProjects();
  }

  async function closeProject(id) {
    await fanboxApi.closeProject(id);
    loadProjects();
  }

  async function drawWinner(id) {
    await fanboxApi.drawProjectWinner(id);
    loadProjects();
  }

  return (
    <div className="page">
      <PageHeader
        module="Projects"
        title={`${type.toUpperCase()} Projects`}
        description={`Create and manage ${type} projects.`}
      />
      <section className="panel">
        <h2>Create new {type} project</h2>
        <div className="toolbar">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project title" />
          <button type="button" className="btn btn--primary" onClick={createProject}>Create</button>
        </div>
      </section>
      <ReportTable
        title={`${type} projects`}
        rows={projects}
        columns={[
          { key: "title", label: "Title" },
          { key: "status", label: "Status" },
          { key: "createdAt", label: "Created at" },
          {
            key: "actions",
            label: "Actions",
            sortable: false,
            render: (_, row) => (
              <div className="row-actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => closeProject(row._id)}>Close</button>
                {type === "raffle" && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => drawWinner(row._id)}>
                    Draw winner
                  </button>
                )}
              </div>
            ),
          },
        ]}
        csvFilename={`projects-${type}.csv`}
      />
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
