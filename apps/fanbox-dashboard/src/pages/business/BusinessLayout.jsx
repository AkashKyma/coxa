import { Outlet, NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import { DateRangeFilter } from "@coxa/ui-analytics";
import { fanboxApi } from "../../lib/api.js";

const TABS = [
  { to: "/business/membership",  label: "Membership" },
  { to: "/business/tickets",     label: "Tickets" },
  { to: "/business/access",      label: "Access" },
  { to: "/business/stores",      label: "Stores" },
  { to: "/business/ecommerce",   label: "E-Commerce" },
  { to: "/business/coxa-foods",  label: "Coxa Foods" },
  { to: "/business/loyalty",     label: "Loyalty" },
  { to: "/business/app",         label: "Official App" },
  { to: "/business/ott",         label: "Coxa Prime TV" },
  { to: "/business/coxa-run",    label: "Coxa Run" },
  { to: "/business/manto",       label: "Manto" },
];

export default function BusinessLayout() {
  const [range, setRange]       = useState({ preset: "30d" });
  const [locations, setLocations] = useState([]);   // all known stores
  const [storeId, setStoreId]   = useState("all");  // selected store filter

  // Load store list for the store-picker once on mount
  useEffect(() => {
    fanboxApi.retailByLocation()
      .then((r) => {
        const locs = r.data ?? [];
        setLocations(locs);
      })
      .catch(() => {}); // non-fatal — store picker stays hidden
  }, []);

  function handleRangeChange(v) {
    setRange(v);
  }

  return (
    <div className="page">
      <PageHeader
        module="Business"
        title="Business Performance"
        description="Track operational KPIs by revenue source."
      />

      {/* ── Toolbar: date presets + store picker ─────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 16, padding: "10px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
        <DateRangeFilter value={range} onChange={handleRangeChange} showPresets />

        {/* Store picker — only rendered when we have ≥2 locations */}
        {locations.length >= 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, borderLeft: "1px solid #e2e8f0", paddingLeft: 12 }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>Store</span>
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              style={{ fontSize: 13, padding: "4px 8px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer" }}
            >
              <option value="all">All Stores</option>
              {locations.map((l) => (
                <option key={l.locationId ?? l.locationName} value={l.locationId ?? l.locationName}>
                  {l.locationName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Source tabs ───────────────────────────────────────── */}
      <nav className="sub-nav" style={{ marginBottom: 20 }}>
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => `sub-nav__link${isActive ? " sub-nav__link--active" : ""}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet context={{ range, storeId, locations }} />
    </div>
  );
}
