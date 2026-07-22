export default function ChartPanel({ title, description, children, actions }) {
  return (
    <section className="panel-card">
      <div className="panel-card__head">
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        {actions}
      </div>
      <div className="panel-card__body">{children}</div>
    </section>
  );
}
