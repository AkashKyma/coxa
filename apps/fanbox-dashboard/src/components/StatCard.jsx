export default function StatCard({ icon: Icon, label, value, color = "green" }) {
  return (
    <div className="stat-card">
      {Icon && (
        <div className={`stat-card__icon stat-card__icon--${color}`}>
          <Icon size={20} strokeWidth={2} />
        </div>
      )}
      <div className="stat-card__body">
        <div className="stat-card__value">{value}</div>
        <div className="stat-card__label">{label}</div>
      </div>
    </div>
  );
}
