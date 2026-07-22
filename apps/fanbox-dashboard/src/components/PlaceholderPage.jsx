import PageHeader from "./PageHeader.jsx";

export default function PlaceholderPage({ module, title, description, taskId }) {
  return (
    <div className="page">
      <PageHeader module={module} title={title} description={description} />
      <div className="placeholder-card">
        <p>Em desenvolvimento — ver <code>{taskId}</code> em FANBOX_PARITY_TASKS.md</p>
      </div>
    </div>
  );
}
