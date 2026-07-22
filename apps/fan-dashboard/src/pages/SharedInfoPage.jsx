import { Link } from "react-router-dom";

function Action({ to, label }) {
  return (
    <Link to={to} className="fan-ios-row">
      <span className="fan-ios-row__icon fan-ios-row__icon--green">→</span>
      <span className="fan-ios-row__body">
        <span className="fan-ios-row__label">{label}</span>
      </span>
      <span className="fan-ios-row__chevron">›</span>
    </Link>
  );
}

export default function SharedInfoPage({
  title,
  eyebrow,
  description,
  sections = [],
  actions = [],
}) {
  return (
    <div className="fan-home">
      <section className="fan-home__hero">
        {eyebrow ? <p className="fan-home__eyebrow">{eyebrow}</p> : null}
        <h1 className="fan-home__title">{title}</h1>
        {description ? (
          <p style={{ margin: "0.75rem 0 0", color: "var(--coxa-text-muted)", lineHeight: 1.6 }}>
            {description}
          </p>
        ) : null}
      </section>

      {sections.map((section) => (
        <section key={section.label} className="fan-ios-group">
          <p className="fan-ios-group__label">{section.label}</p>
          <ul className="fan-ios-list">
            {section.items.map((item) => (
              <li key={item.label}>
                <div className="fan-ios-row">
                  <span className={`fan-ios-row__icon ${item.iconClass ?? "fan-ios-row__icon--ink"}`}>
                    {item.icon ?? "•"}
                  </span>
                  <span className="fan-ios-row__body">
                    <span className="fan-ios-row__label">{item.label}</span>
                    {item.detail ? <span className="fan-ios-row__detail">{item.detail}</span> : null}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {actions.length ? (
        <section className="fan-ios-group">
          <p className="fan-ios-group__label">Quick actions</p>
          <ul className="fan-ios-list">
            {actions.map((action) => (
              <li key={action.label}>
                <Action to={action.to} label={action.label} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
