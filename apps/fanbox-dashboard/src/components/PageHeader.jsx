export default function PageHeader({ module, title, description, actions, children }) {
  return (
    <header className="module-header">
      {module && <span className="module-header__badge">{module}</span>}
      <div className="module-header__row">
        <div className="module-header__text">
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="module-header__actions">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
