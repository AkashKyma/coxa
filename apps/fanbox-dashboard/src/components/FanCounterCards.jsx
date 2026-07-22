import { CreditCard, Mail, MapPin, Phone, Users } from "lucide-react";
import KpiCard from "./KpiCard.jsx";

const COUNTER_DEFS = [
  { key: "totalFans", label: "Total fans", icon: Users, accent: true },
  { key: "withCpf", label: "With CPF", icon: CreditCard },
  { key: "withEmail", label: "With email", icon: Mail },
  { key: "withPhone", label: "With phone", icon: Phone },
  { key: "withAddress", label: "With address", icon: MapPin },
];

function formatCount(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-US");
}

export default function FanCounterCards({ counters = {}, loading = false }) {
  return (
    <section className="dashboard-section">
      <h2 className="overview-section-title">Fan base overview</h2>
      <div className="kpi-grid">
        {COUNTER_DEFS.map(({ key, label, icon, accent }) => (
          <KpiCard
            key={key}
            icon={icon}
            label={label}
            value={formatCount(counters[key])}
            accent={accent}
            loading={loading}
          />
        ))}
      </div>
    </section>
  );
}
