import { useState } from "react";
import { Shield, ChevronRight } from "lucide-react";
import { ROLE_REGISTRY, ROLE_CATEGORIES, ROLE_MODULE_LABELS } from "../lib/roleRegistry.js";

const SCOPE_LABEL = {
  platform:    "Platform",
  club:        "Club",
  module:      "Module",
  location:    "Location",
  vendor:      "Vendor",
  self:        "Self",
  privacy:     "Privacy",
  integration: "Integration",
  audit:       "Audit",
};

const CATEGORY_COLOR = {
  administration: "#3b82f6",
  security:       "#ef4444",
  finance:        "#22c55e",
  support:        "#eab308",
  data:           "#8b5cf6",
  marketing:      "#ec4899",
  ticketing:      "#f97316",
  operations:     "#fb923c",
  commerce:       "#14b8a6",
  marketplace:    "#06b6d4",
  platform:       "#6b7280",
  fan:            "#94a3b8",
};

export default function RolesPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [expanded, setExpanded] = useState(null);

  const byCategory = {};
  for (const role of Object.values(ROLE_REGISTRY)) {
    if (role.code === "fan_member") continue; // staff view — fan role listed separately
    (byCategory[role.category] = byCategory[role.category] ?? []).push(role);
  }

  const categories = ROLE_CATEGORIES.filter((c) => byCategory[c.key]?.length > 0);
  const visibleCategories =
    activeCategory === "all"
      ? categories
      : categories.filter((c) => c.key === activeCategory);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Role Registry</h1>
          <p className="text-muted">
            {Object.values(ROLE_REGISTRY).length} platform roles · RBAC module access mapped below
          </p>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="role-registry-tabs">
        <button
          className={`role-tab ${activeCategory === "all" ? "role-tab--active" : ""}`}
          onClick={() => setActiveCategory("all")}
        >
          All categories
        </button>
        {categories.map((cat) => (
          <button
            key={cat.key}
            className={`role-tab ${activeCategory === cat.key ? "role-tab--active" : ""}`}
            onClick={() => setActiveCategory(cat.key)}
            style={activeCategory === cat.key ? { borderColor: cat.color, color: cat.color } : {}}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Category sections */}
      <div className="role-registry">
        {visibleCategories.map((cat) => (
          <section key={cat.key} className="role-category-section">
            <div
              className="role-category-section__header"
              style={{ "--cat-color": cat.color }}
            >
              <span
                className="role-category-section__dot"
                style={{ background: cat.color }}
              />
              <h2>{cat.label}</h2>
              <span className="text-muted" style={{ fontWeight: "normal", fontSize: "0.85rem" }}>
                {byCategory[cat.key]?.length} role{byCategory[cat.key]?.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="role-cards-grid">
              {(byCategory[cat.key] ?? []).map((role) => {
                const isExpanded = expanded === role.code;
                const modules = ROLE_MODULE_LABELS[role.code] ?? [];
                return (
                  <article
                    key={role.code}
                    className={`role-card ${isExpanded ? "role-card--expanded" : ""}`}
                    style={{ "--card-accent": cat.color }}
                  >
                    <button
                      className="role-card__head"
                      onClick={() => setExpanded(isExpanded ? null : role.code)}
                    >
                      <div className="role-card__icon">
                        <Shield size={16} style={{ color: cat.color }} />
                      </div>
                      <div className="role-card__title-area">
                        <span className="role-card__name">{role.name}</span>
                        <span
                          className="badge"
                          style={{
                            background: cat.color + "22",
                            color: cat.color,
                            border: `1px solid ${cat.color}44`,
                          }}
                        >
                          {SCOPE_LABEL[role.scope] ?? role.scope}
                        </span>
                      </div>
                      <ChevronRight
                        size={16}
                        className="role-card__chevron"
                        style={{ transform: isExpanded ? "rotate(90deg)" : "none" }}
                      />
                    </button>

                    {isExpanded && (
                      <div className="role-card__body">
                        <p className="role-card__desc">{role.description}</p>

                        {modules.length > 0 && (
                          <div className="role-card__modules">
                            <span className="role-card__modules-label">Dashboard access:</span>
                            <div className="role-card__module-tags">
                              {modules.map((m) => (
                                <span key={m} className="badge badge--blue">{m}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {role.surfaces?.length > 0 && (
                          <div className="role-card__modules" style={{ marginTop: "var(--space-2)" }}>
                            <span className="role-card__modules-label">Surfaces:</span>
                            <div className="role-card__module-tags">
                              {role.surfaces.map((s) => (
                                <span key={s} className="badge">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="role-card__code">
                          <code>{role.code}</code>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
