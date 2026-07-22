export default function KpiCard({ icon: Icon, label, value, accent = false, loading = false }) {
  return (
    <div className={`kpi-card${accent ? " kpi-card--accent" : ""}`}>
      {Icon && (
        <span className="kpi-card__icon">
          <Icon size={18} strokeWidth={2} />
        </span>
      )}
      <span className="kpi-card__value">{loading ? "—" : value}</span>
      <span className="kpi-card__label">{label}</span>
    </div>
  );
}
