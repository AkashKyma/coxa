import { NavLink } from "react-router-dom";

export default function SidebarNavLink({ to, end, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `sidebar-link${isActive ? " sidebar-link--active" : ""}`
      }
      title={label}
    >
      <span className="sidebar-link__icon">
        <Icon size={16} strokeWidth={2} aria-hidden />
      </span>
      <span className="sidebar-link__label">{label}</span>
    </NavLink>
  );
}
