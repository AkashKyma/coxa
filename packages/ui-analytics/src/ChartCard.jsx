/**
 * ChartCard — wrapper panel for any chart component.
 * Provides title, optional subtitle, viz-switcher, and drill-down support.
 *
 * Props:
 *   title        – string
 *   subtitle     – string
 *   vizOptions   – string[]  e.g. ['bar','line','table']
 *   activeViz    – string
 *   onVizChange  – fn(vizKey)
 *   loading      – boolean
 *   empty        – boolean
 *   children     – the actual chart/table element
 *   actions      – extra JSX placed in header (e.g. export button)
 */
export default function ChartCard({
  title,
  subtitle,
  vizOptions = [],
  activeViz,
  onVizChange,
  loading = false,
  empty = false,
  children,
  actions,
}) {
  return (
    <section className="panel-card chart-card">
      <div className="panel-card__head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="chart-card__subtitle">{subtitle}</p>}
        </div>
        <div className="chart-card__controls">
          {vizOptions.length > 1 && (
            <div className="viz-switcher">
              {vizOptions.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`btn btn--xs${activeViz === v ? " btn--primary" : " btn--ghost"}`}
                  onClick={() => onVizChange?.(v)}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          )}
          {actions}
        </div>
      </div>
      <div className="panel-card__body">
        {loading && <div className="chart-card__loading">Loading…</div>}
        {!loading && empty && <p className="empty-state">No data available.</p>}
        {!loading && !empty && children}
      </div>
    </section>
  );
}
